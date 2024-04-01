import boto3
import json
from pytz import timezone
from datetime import datetime
import common

dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    args = event["arguments"]
    userid = args["userid"]  # TODO: トークンから取得
    settings = args["settings"]

    res = table.get_item(Key={"pk": "settings#%s" % userid, "sk": "settings"})
    old = res["Item"] if "Item" in res else None
    tm = str(datetime.now(timezone("Asia/Tokyo")))
    try:
        item = {
            "pk": "settings#%s" % userid,
            "sk": "settings",
            "settings": settings,
            "createdAt": old["createdAt"] if old else tm[:19],  # yyyy-mm-dd hh:mm:ss
            "updatedAt": tm[:19],  # yyyy-mm-dd hh:mm:ss
        }
        table.put_item(Item=item)
        return "Success"
    except Exception as e:
        raise Exception("user settings putting Error:", e)
