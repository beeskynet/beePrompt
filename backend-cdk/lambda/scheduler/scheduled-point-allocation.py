import json
import boto3
from datetime import datetime, timedelta
import calendar
from pytz import timezone
from decimal import Decimal
import os
import traceback

import common

# 環境変数から設定を取得
TABLE_NAME = os.environ.get('TABLE_NAME', '')
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

def calculate_effective_days(custom_days=None, custom_minutes=None):
    """有効期限までの日数を計算
    
    Args:
        custom_days: テスト用のカスタム有効期限日数
        custom_minutes: テスト用のカスタム有効期限分数（custom_daysより優先）
    
    Returns:
        有効期限日数（整数）
    """
    if custom_minutes is not None:
        # テスト用: 分数を日数に変換（最低1日）
        return max(1, int(custom_minutes / 1440))  # 1440分 = 1日
    elif custom_days is not None:
        # テスト用: 指定日数
        return custom_days
    else:
        # 本番用: 月末までの日数を計算
        now = datetime.now(timezone("Asia/Tokyo"))
        last_day = calendar.monthrange(now.year, now.month)[1]
        remaining_days = last_day - now.day + 1  # 当日を含む
        return remaining_days

def get_default_config():
    """デフォルトのポイント配布設定を取得"""
    try:
        response = table.get_item(
            Key={
                'pk': 'config#point-allocation',
                'sk': 'default'
            }
        )
        if 'Item' in response:
            return int(response['Item'].get('monthlyPoints', 0))
        return 0  # デフォルト設定がない場合は0ポイント
    except Exception as e:
        print(f"Error getting default config: {e}")
        return 0

def get_user_config(userid):
    """ユーザー個別のポイント配布設定を取得"""
    try:
        response = table.get_item(
            Key={
                'pk': 'config#point-allocation',
                'sk': f'user#{userid}'
            }
        )
        if 'Item' in response:
            return int(response['Item'].get('monthlyPoints', -1))
        return -1  # 個別設定がない場合は-1を返す
    except Exception as e:
        print(f"Error getting user config for {userid}: {e}")
        return -1

def get_privileged_users():
    """privilegedユーザーリストを取得"""
    try:
        print(f"Getting privileged users from table: {TABLE_NAME}")
        response = table.get_item(
            Key={
                'pk': 'privileged-users',
                'sk': 'privileged-users'
            }
        )
        print(f"DynamoDB response: {response}")
        
        if 'Item' in response and 'users' in response['Item']:
            users_json = response['Item']['users']
            users = json.loads(users_json)
            print(f"Found {len(users)} users in privileged-users")
            return users
        else:
            print("No privileged-users item found in DynamoDB")
        return []
    except Exception as e:
        print(f"Error getting privileged users: {e}")
        import traceback
        print(traceback.format_exc())
        return []

def add_points_to_user(userid, points, effective_days, effective_minutes=None):
    """ユーザーにポイントを付与
    
    Args:
        userid: ユーザーID
        points: 付与ポイント数
        effective_days: 有効期限日数（月末までの日数）
        effective_minutes: 有効期限分数（テスト用）
    """
    try:
        # common.pyのadd_points関数を使用してポイントを付与
        if effective_minutes is not None:
            common.add_points(userid, points, 0, effective_minutes)
        else:
            common.add_points(userid, points, effective_days)
        return True, None
    except Exception as e:
        error_msg = f"Error adding points to user {userid}: {e}"
        print(error_msg)
        return False, error_msg

def record_allocation_history(userid, points, expiration_date, error_msg=None):
    """ポイント配布履歴を記録"""
    try:
        now = datetime.now(timezone("Asia/Tokyo"))
        year_month = now.strftime('%Y-%m')
        timestamp = now.strftime('%Y-%m-%d %H:%M:%S.%f')
        
        item = {
            'pk': f'pt-alloc-hist#{year_month}',
            'sk': f'{userid}#{timestamp}',
            'userId': userid,
            'allocatedPoints': points,
            'expirationDate': expiration_date,
            'createdAt': now.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        if error_msg:
            item['errorMessage'] = error_msg
        
        table.put_item(Item=item)
    except Exception as e:
        print(f"Error recording allocation history: {e}")

def lambda_handler(event, context):
    """
    定期実行用Lambda関数のハンドラー
    
    EventBridgeから呼び出される想定
    テスト用にeventに custom_expiration_days または custom_expiration_minutes を含めることで有効期限をカスタマイズ可能
    """
    print(f"Event: {json.dumps(event)}")
    
    # テスト用のカスタム有効期限を取得（指定がない場合はNone）
    custom_days = event.get('custom_expiration_days')
    custom_minutes = event.get('custom_expiration_minutes')
    
    try:
        # デフォルト設定を取得
        default_points = get_default_config()
        print(f"Default monthly points: {default_points}")
        
        # privilegedユーザーリストを取得
        privileged_users = get_privileged_users()
        print(f"Found {len(privileged_users)} privileged users")
        
        # 有効期限日数を計算
        effective_days = calculate_effective_days(custom_days, custom_minutes)
        print(f"Effective days: {effective_days}")
        
        # 各ユーザーに対してポイントを配布
        success_count = 0
        error_count = 0
        skip_count = 0
        
        for user in privileged_users:
            userid = user.get('sub', '')
            username = user.get('username', '')
            
            if not userid:
                print(f"Skip user without sub: {username}")
                continue
            
            # ユーザー個別設定を確認
            user_points = get_user_config(userid)
            
            # 配布ポイント数を決定（個別設定がある場合はそれを優先）
            points_to_allocate = user_points if user_points >= 0 else default_points
            
            if points_to_allocate == 0:
                print(f"Skip user {username} (userid: {userid}) - 0 points configured")
                skip_count += 1
                record_allocation_history(userid, 0, f"{effective_days} days")
                continue
            
            # ポイント付与
            success, error_msg = add_points_to_user(userid, points_to_allocate, effective_days, custom_minutes)
            
            if success:
                print(f"Successfully allocated {points_to_allocate} points to {username} (userid: {userid})")
                success_count += 1
                record_allocation_history(userid, points_to_allocate, f"{effective_days} days")
            else:
                print(f"Failed to allocate points to {username} (userid: {userid}): {error_msg}")
                error_count += 1
                record_allocation_history(userid, points_to_allocate, f"{effective_days} days", error_msg)
        
        # レスポンス内容を構築
        response_body = {
            'message': 'Monthly point allocation completed',
            'success_count': success_count,
            'error_count': error_count,
            'skip_count': skip_count,
            'total_users': len(privileged_users),
        }
        
        # 有効期限の情報を追加
        if custom_minutes is not None:
            response_body['effective_minutes'] = custom_minutes
        else:
            response_body['effective_days'] = effective_days
        
        result = {
            'statusCode': 200,
            'body': json.dumps(response_body)
        }
        
        print(f"Result: {json.dumps(result)}")
        return result
        
    except Exception as e:
        error_msg = f"Error in lambda_handler: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Monthly point allocation failed',
                'error': str(e)
            })
        }
