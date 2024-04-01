import json
import boto3
import re
import os
from boto3.dynamodb.conditions import Key, Attr
from pytz import timezone
from datetime import datetime, timedelta
import common

dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    userids = event["arguments"]["userids"]
    print("start")
    print(userids)

    def get_effective_balance(userid):
        """有効残高を取得"""
        response = table.query(KeyConditionExpression=Key("pk").eq("pt#%s" % userid), ScanIndexForward=True)
        return [
            item
            for item in response["Items"]
            if item["balance"] < 0 or item["sk"] > str(datetime.now(timezone("Asia/Tokyo")))
        ]

    result_list = []
    for userid in userids:
        balances = get_effective_balance(userid)
        for balance in balances:
            balance["userid"] = re.sub("^pt#", "", balance.pop("pk"))
            balance["expiryDate"] = balance["sk"]
            result_list.append(balance)
    print(result_list)

    return result_list
