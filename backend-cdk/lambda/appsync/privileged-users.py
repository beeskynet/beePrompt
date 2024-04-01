import json
import os
from pytz import timezone
import boto3
import json
import common


def toCamelCase(string, titleCase=False):
    import re

    if titleCase:
        return "".join(x.title() for x in string.split("_"))
    else:
        return re.sub("_(.)", lambda m: m.group(1).upper(), string.lower())


def get_user_groups(user_pool_id, username):
    client = boto3.client("cognito-idp")
    response = client.admin_list_groups_for_user(UserPoolId=user_pool_id, Username=username)
    return [group["GroupName"] for group in response["Groups"]]


def users():
    # Cognitoの設定
    user_pool_id = common.user_pool_id
    group_name = "privileged"

    # boto3のセットアップ
    client = boto3.client("cognito-idp")
    # ユーザー一覧を取得
    response = client.list_users_in_group(UserPoolId=user_pool_id, GroupName=group_name, Limit=60)  # 取得する上限数

    newUsers = []
    for user in response["Users"]:
        newUser = {}
        newUsers.append(newUser)
        newUser["username"] = user["Username"]
        for attr in user["Attributes"]:
            newUser[toCamelCase(attr["Name"])] = attr["Value"]  # sub, email, emailVerified
        newUser["groups"] = get_user_groups(user_pool_id, user["Username"])
        newUser["userCreateDate"] = str(user["UserCreateDate"].astimezone(timezone("Asia/Tokyo")))
        newUser["userLastModifiedDate"] = str(user["UserLastModifiedDate"].astimezone(timezone("Asia/Tokyo")))
    return newUsers


def lambda_handler(event, context):
    return users()
