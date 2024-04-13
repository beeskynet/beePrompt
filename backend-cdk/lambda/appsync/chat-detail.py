import json
import boto3
import re
import os
from boto3.dynamodb.conditions import Key, Attr
import common

dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, _):
    userid = event["identity"]["claims"]["sub"]
    chatid = event["arguments"]["chatid"]

    res = table.get_item(Key={"pk": "chat#%s" % userid, "sk": chatid})
    chat = res["Item"] if "Item" in res else None
    if chat:
        chat["chatid"] = chat.pop("sk")
        chat["chat"] = json.loads(chat["chat"])
        chat["userid"] = re.sub("^chat#", "", chat.pop("pk"))
    return chat
