import json
from datetime import datetime
from pytz import timezone
import boto3
import common

dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def delete_chats(userid, chatids):
    # 更新前チャットデータ
    for chatid in chatids:
        table.delete_item(Key={"pk": "chat#%s" % userid, "sk": chatid})


def lambda_handler(event, context):
    print(event)
    args = event["arguments"]
    userid = args["userid"]
    chatids = args["chatids"]
    delete_chats(userid, chatids)
    return "Success"
