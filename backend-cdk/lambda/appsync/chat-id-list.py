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
    LastEvaluatedKey = event["arguments"].get("LastEvaluatedKey")

    def convert_string_to_dict(input_str):
        result_dict = {}
        for item in input_str.strip("{}").split(", "):
            key, value = item.split("=")
            result_dict[key] = value
        return result_dict

    options = {"ExclusiveStartKey": convert_string_to_dict(LastEvaluatedKey)} if LastEvaluatedKey else {}
    # DynamoDBに問い合わせ
    res = table.query(
        IndexName="pk-updatedAt-index",
        KeyConditionExpression=Key("pk").eq("chat#%s" % userid),
        ScanIndexForward=False,
        ProjectionExpression="sk,title,createdAt,updatedAt",
        Limit=50,
        **options,
    )

    def change_key_name(chat):
        chat["chatid"] = chat.pop("sk")
        return chat

    response = {
        "chats": [change_key_name(chat) for chat in res["Items"]],
        "LastEvaluatedKey": res.get("LastEvaluatedKey"),
    }
    return response
