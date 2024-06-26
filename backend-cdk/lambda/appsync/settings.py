import boto3
import json
import common

dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, _):
    userid = event["identity"]["claims"]["sub"]

    try:
        res = table.get_item(Key={"pk": "settings#%s" % userid, "sk": "settings"})
        return res["Item"]["settings"] if "Item" in res else None
    except Exception as e:
        raise Exception("get user settings Error:", e)
