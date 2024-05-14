import os
from datetime import datetime, timedelta
from pytz import timezone
import json
from boto3.dynamodb.conditions import Key
import boto3
import traceback
from decimal import Decimal
from enum import Enum

table_name = (
    str(os.environ.get("DB_TABLE_NAME"))  # CDK環境変数で既存DBを指定した場合
    if os.environ.get("DB_TABLE_NAME")
    else str(os.environ.get("PROJECT_NAME")) + "-db"
)
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(table_name)
stack_name = os.environ.get("PROJECT_NAME")
user_pool_id = os.environ.get("USER_POOL_ID")
yen_1dollar = "150"
point_1yen = "1"
region = "ap-northeast-1"


class Model(Enum):
    gpt35turbo = "gpt-3.5-turbo-0125"
    # gpt35turbo_instract = 'gpt-3.5-turbo-instruct'
    gpt4 = "gpt-4"
    gpt4turbo_preview = "gpt-4-0125-preview"
    gpt4turbo = "gpt-4-turbo-2024-04-09"
    gpt4o = "gpt-4o-2024-05-13"
    claude_v3_sonnet = "anthropic.claude-3-sonnet-20240229-v1:0"
    claude_v2 = "anthropic.claude-v2"
    claude_v2_1 = "anthropic.claude-v2:1"
    claude_instant_v1 = "anthropic.claude-instant-v1"
    claude_3_opus = "claude-3-opus-20240229"
    claude_3_sonnet = "claude-3-sonnet-20240229"
    claude_3_haiku = "claude-3-haiku-20240307"


# https://openai.com/pricing
# https://aws.amazon.com/bedrock/pricing/
# $x.xx/1K tokens
PRICE = {
    # gpt #
    Model.gpt35turbo.value: {"in": 0.0005, "out": 0.0015},
    # Model.gpt35turbo_instract.value: { 'in': 0.0015, 'out': 0.002 },
    Model.gpt4.value: {"in": 0.03, "out": 0.06},
    Model.gpt4turbo_preview.value: {"in": 0.01, "out": 0.03},
    Model.gpt4turbo.value: {"in": 0.01, "out": 0.03},
    Model.gpt4o.value: {"in": 0.005, "out": 0.015},
    # claude #
    Model.claude_instant_v1.value: {"in": 0.00163, "out": 0.00551},
    Model.claude_v2.value: {"in": 0.008, "out": 0.024},
    Model.claude_v2_1.value: {"in": 0.008, "out": 0.024},
    Model.claude_v3_sonnet.value: {"in": 0.003, "out": 0.015},
    Model.claude_3_haiku.value: {"in": 0.00025, "out": 0.00125},
    Model.claude_3_sonnet.value: {"in": 0.003, "out": 0.015},
    Model.claude_3_opus.value: {"in": 0.015, "out": 0.075},
}


def access_db_retry(func, prms):
    from botocore.exceptions import ClientError
    import time

    MAX_ATTEMPTS = 3
    WAIT_TIME_TRANSACTION_CANCELED = 0.1  # 100ms
    WAIT_TIME_OTHER_EXCEPTIONS = 3  # 3秒
    attempts = 0
    while attempts < MAX_ATTEMPTS:
        try:
            return func(**prms)
        except ClientError as e:
            error = e.response.get("Error")
            error_code = error.get("Code") if error else None
            if error_code == "TransactionCanceledException":
                print(e.response.get("Message"))
                time.sleep(WAIT_TIME_TRANSACTION_CANCELED)
            elif error_code == "ResourceNotFoundException":
                print(e)
                print("Not retry.")
                break
            else:
                print("An unexpected error occurred:", e)
                print(f"{traceback.format_exc()}")
                time.sleep(WAIT_TIME_OTHER_EXCEPTIONS)
        except Exception as e:
            print("An unexpected error occurred:", e)
            print(f"{traceback.format_exc()}")
            time.sleep(WAIT_TIME_OTHER_EXCEPTIONS)
        finally:
            attempts += 1
    raise Exception("Transaction failed after max attempts")


def validate_token(token, dtm):
    import jwt
    from jwt import PyJWKClient

    issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
    jwks_url = f"{issuer}/.well-known/jwks.json"
    jwks_client = PyJWKClient(jwks_url)
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    decoded = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        # audience=app_client_id,
        issuer=issuer,
        options={"verify_signature": True},
    )
    if "cognito:groups" in decoded and "active" in decoded["cognito:groups"]:
        return {"success": True, "access_token": decoded}
    return {
        "success": False,
        "error-response": {"error": "permission denied", "dtm": dtm},
    }


def check_enough_points(userid: str, in_usage_point: str):
    """ポイント残高チェック"""

    def get_effective_balance(userid):
        """有効残高を取得"""
        response = table.query(
            KeyConditionExpression=Key("pk").eq("pt#%s" % userid)
            & Key("sk").gt(str(datetime.now(timezone("Asia/Tokyo")))),
            ScanIndexForward=True,
        )
        return response["Items"]

    effective_balances = get_effective_balance(userid)
    if sum([item["balance"] for item in effective_balances]) < float(in_usage_point):
        return {
            "success": False,
            "error-response": {
                "error": "Not enough points",
                "errorType": "LackOfPoints",
            },
        }
    return {"success": True}


def save_usage(userid, io_type, model, io_costs):
    dtm = str(datetime.now(timezone("Asia/Tokyo")))
    item = {
        "pk": "usage#%s" % userid,
        "sk": dtm[:25],  # yyyy-mm-dd hh:mm:ss.sssss
        "dtype": "usage",
        "io_type": io_type,
        "model": model,
        "platform": "openai" if model.startswith("gpt") else "amazon",
        "est_token": io_costs[f"{io_type}_token"],
        "est_dollar": Decimal(io_costs[f"{io_type}_dollar"]),
        "est_yen": Decimal(io_costs[f"{io_type}_yen"]),
        "usage_point": Decimal(io_costs[f"{io_type}_usage_point"]),
        "dollar_1token": Decimal("%.5f" % PRICE[model][io_type]),
        "yen_1dollar": Decimal(yen_1dollar),
        "point_1yen": Decimal(point_1yen),
        "createdAt": dtm[:19],  # yyyy-mm-dd hh:mm:ss
    }
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)
    table.put_item(
        Item=item,
        ConditionExpression="attribute_not_exists(pk) AND attribute_not_exists(sk)",
    )


def use_points(userid, points_to_use):
    if points_to_use < 0:
        raise Exception("use_points()のpoints_to_useはマイナス値不可:points_to_add=%f" % points_to_use)

    def get_effective_balance(userid):
        """有効残高を取得"""
        response = table.query(
            KeyConditionExpression=Key("pk").eq("pt#%s" % userid)
            & Key("sk").gt(str(datetime.now(timezone("Asia/Tokyo")))),
            ScanIndexForward=True,
        )
        return [item for item in response["Items"] if item["balance"] > 0]

    effective_balances = get_effective_balance(userid)

    # 一括更新内容を作成
    TransactItems = []
    if len(effective_balances) == 0:
        # 残高レコードがない ※API利用時にはありえない
        # 残高付与登録
        expiryDate = str(datetime.now(timezone("Asia/Tokyo")) + timedelta(days=365))[:25]
        now = datetime.now(timezone("Asia/Tokyo"))
        TransactItems.append(
            {
                "Put": {
                    "TableName": table_name,
                    "Item": {
                        "pk": {"S": "pt#%s" % userid},
                        "sk": {"S": expiryDate},
                        "balance": {"N": str(-points_to_use)},
                        "createdAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                        "updatedAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                    },
                }
            }
        )
        # ポイント残高更新ログ
        TransactItems.append(
            {
                "Put": {
                    "TableName": table_name,
                    "Item": {
                        "pk": {"S": "ptlog#%s" % userid},
                        "sk": {
                            "S": "%s#%s"
                            % (
                                expiryDate,
                                str(datetime.now(timezone("Asia/Tokyo")))[:25],
                            )
                        },
                        "balance": {"N": str(-points_to_use)},
                        "additionalPoints": {"N": str(-points_to_use)},
                        "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                    },
                }
            }
        )
    for effe_balance in effective_balances:

        def append_use_balance_item_to_transact(TransactItems, effe_balance):
            new_balance = effe_balance["balance"] - Decimal(points_to_use)
            TransactItems.append(
                {
                    "Update": {
                        "TableName": table_name,
                        "Key": {
                            "pk": {"S": "pt#%s" % userid},
                            "sk": {"S": effe_balance["sk"]},
                        },
                        "ConditionExpression": "balance = :orig_balance",
                        "UpdateExpression": "SET balance = :new_balance, updatedAt = :updatedAt",
                        "ExpressionAttributeValues": {
                            ":orig_balance": {"N": str(effe_balance["balance"])},
                            ":new_balance": {"N": str(new_balance)},
                            ":updatedAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    },
                }
            )
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "ptlog#%s" % userid},
                            "sk": {
                                "S": "%s#%s"
                                % (
                                    effe_balance["sk"],
                                    str(datetime.now(timezone("Asia/Tokyo")))[:25],
                                )
                            },
                            "balance": {"N": str(new_balance)},
                            "additionalPoints": {"N": str(-points_to_use)},
                            "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
            return TransactItems

        def append_delete_balance_item_to_transact(TransactItems, effe_balance):
            TransactItems.append(
                {
                    "Delete": {
                        "TableName": table_name,
                        "Key": {
                            "pk": {"S": "pt#%s" % userid},
                            "sk": {"S": effe_balance["sk"]},
                        },
                        "ConditionExpression": "balance = :orig_balance",
                        "ExpressionAttributeValues": {":orig_balance": {"N": str(effe_balance["balance"])}},
                    },
                }
            )
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "ptlog#%s" % userid},
                            "sk": {
                                "S": "%s#%s"
                                % (
                                    effe_balance["sk"],
                                    str(datetime.now(timezone("Asia/Tokyo")))[:25],
                                )
                            },
                            "balance": {"N": "0"},
                            "additionalPoints": {"N": str(-effe_balance["balance"])},
                            "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
            return TransactItems

        if effe_balance["balance"] > points_to_use:
            # 残高から利用ポイントを引いて終了
            TransactItems = append_use_balance_item_to_transact(TransactItems, effe_balance)
            break
        elif effe_balance["balance"] == points_to_use:
            # 残高=利用ポイント→0  ※ほぼありえない
            TransactItems = append_delete_balance_item_to_transact(TransactItems, effe_balance)
            break
        elif effe_balance["balance"] < points_to_use:
            if effe_balance["sk"] == effective_balances[-1]["sk"]:
                # 最新レコード: マイナス残高に更新して終了
                TransactItems = append_use_balance_item_to_transact(TransactItems, effe_balance)
            else:
                # 非最新レコード: 残高レコードを削除し、利用ポイントから残高レコードの残高を引いて継続
                TransactItems = append_delete_balance_item_to_transact(TransactItems, effe_balance)
                points_to_use = Decimal(points_to_use) - Decimal(effe_balance["balance"])
    client = boto3.client("dynamodb", region_name="ap-northeast-1")
    client.transact_write_items(TransactItems=TransactItems)


def add_points(userid, points_to_add, effective_days):
    if points_to_add < 0:
        raise Exception("add_point()のpoints_to_addはマイナス値不可:points_to_add=%f" % points_to_add)

    def get_negative_balance(userid):
        """マイナス残高を取得"""
        response = table.query(KeyConditionExpression=Key("pk").eq("pt#%s" % userid), ScanIndexForward=True)
        items = response["Items"]
        negative_balances = [item for item in items if item["balance"] < 0]
        return negative_balances

    negative_balances = get_negative_balance(userid)

    # 一括更新内容を作成
    TransactItems = []
    for nega_balance in negative_balances:
        if points_to_add >= -nega_balance["balance"]:
            # マイナス残高を相殺->残高なし
            TransactItems.append(
                {
                    "Delete": {
                        "TableName": table_name,
                        "Key": {
                            "pk": {"S": "pt#%s" % userid},
                            "sk": {"S": nega_balance["sk"]},
                        },
                        "ConditionExpression": "balance = :orig_balance",
                        "ExpressionAttributeValues": {":orig_balance": {"N": str(nega_balance["balance"])}},
                    },
                }
            )
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "ptlog#%s" % userid},
                            "sk": {
                                "S": "%s#%s"
                                % (
                                    nega_balance["sk"],
                                    str(datetime.now(timezone("Asia/Tokyo")))[:25],
                                )
                            },
                            "balance": {"N": "0"},
                            "additionalPoints": {"N": str(-nega_balance["balance"])},
                            "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
            points_to_add += nega_balance["balance"]
        else:
            # マイナス残高を相殺->残高あり
            new_balance = nega_balance["balance"] + points_to_add
            TransactItems.append(
                {
                    "Update": {
                        "TableName": table_name,
                        "Key": {
                            "pk": {"S": "pt#%s" % userid},
                            "sk": {"S": nega_balance["sk"]},
                        },
                        "ConditionExpression": "balance = :orig_balance",
                        "UpdateExpression": "SET balance = :new_balance, updatedAt = :updatedAt",
                        "ExpressionAttributeValues": {
                            ":orig_balance": {"N": str(nega_balance["balance"])},
                            ":new_balance": {"N": str(new_balance)},
                            ":updatedAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    },
                }
            )
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "ptlog#%s" % userid},
                            "sk": {
                                "S": "%s#%s"
                                % (
                                    nega_balance["sk"],
                                    str(datetime.now(timezone("Asia/Tokyo")))[:25],
                                )
                            },
                            "balance": {"N": str(new_balance)},
                            "additionalPoints": {"N": str(points_to_add)},
                            "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
            points_to_add = 0
            break
    if points_to_add > 0:
        # ポイント付与
        now = datetime.now(timezone("Asia/Tokyo"))
        expiryDate = str(now + timedelta(days=effective_days))[:25]  # 有効期限(yyyy-mm-dd hh:mm:ss.sssss)
        # 残高付与登録
        TransactItems.append(
            {
                "Put": {
                    "TableName": table_name,
                    "Item": {
                        "pk": {"S": "pt#%s" % userid},
                        "sk": {"S": expiryDate},
                        "balance": {"N": str(points_to_add)},
                        "createdAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                        "updatedAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                    },
                }
            }
        )
        # ポイント残高更新ログ
        TransactItems.append(
            {
                "Put": {
                    "TableName": table_name,
                    "Item": {
                        "pk": {"S": "ptlog#%s" % userid},
                        "sk": {
                            "S": "%s#%s"
                            % (
                                expiryDate,
                                str(datetime.now(timezone("Asia/Tokyo")))[:25],
                            )
                        },
                        "balance": {"N": str(points_to_add)},
                        "additionalPoints": {"N": str(points_to_add)},
                        "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                    },
                }
            }
        )
    client = boto3.client("dynamodb", region_name="ap-northeast-1")
    client.transact_write_items(TransactItems=TransactItems)
