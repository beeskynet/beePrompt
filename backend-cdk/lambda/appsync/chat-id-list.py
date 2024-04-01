import boto3
import os
from boto3.dynamodb.conditions import Key
import common

# DynamoDB クライアントの初期化
dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    print(event)
    userid = event["arguments"]["userid"]

    # DynamoDBに問い合わせ
    res = table.query(
        IndexName="pk-updatedAt-index",
        KeyConditionExpression=Key("pk").eq("chat#%s" % userid),
        ScanIndexForward=False,
        ProjectionExpression="sk,title,createdAt,updatedAt",
        Limit=50,
    )

    def change_key_name(chat):
        chat["chatid"] = chat.pop("sk")
        return chat

    return [change_key_name(chat) for chat in res["Items"]]
