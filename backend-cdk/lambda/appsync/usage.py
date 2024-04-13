import json
import boto3
import re
from boto3.dynamodb.conditions import Key, Attr
from pytz import timezone
from datetime import datetime, timedelta
import common

dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, _):
    userid = event["identity"]["claims"]["sub"]

    def sum_by_key(data, keyname, valuename):
        result = {}
        for d in data:
            key = d[keyname]
            if key not in result:
                result[key] = 0
            result[key] += d[valuename]
        return [{keyname: key, valuename: result[key]} for key in result.keys()]

    def get_usage(userid):
        start_day = str(datetime.now(timezone("Asia/Tokyo")) - timedelta(days=30 * 7))[:10]
        options = {}
        items = []
        done = False

        while not done:
            response = table.query(
                KeyConditionExpression=Key("pk").eq("usage#%s" % userid) & Key("sk").gte(start_day), **options
            )
            items.extend(response["Items"])
            # 次ループ準備
            done = "LastEvaluatedKey" not in response
            options["ExclusiveStartKey"] = response.get("LastEvaluatedKey")
        return items

    data = get_usage(userid)
    for_smr = [{"day": d["sk"][:10], "usage_point": d["usage_point"]} for d in data if "usage_point" in d]
    smr_daily = sum_by_key(for_smr, "day", "usage_point")
    for_mon_smr = [{"month": d["day"][:7], "usage_point": d["usage_point"]} for d in smr_daily if "usage_point" in d]
    smr_monthly = sum_by_key(for_mon_smr, "month", "usage_point")

    def dicToCamelCase(dic):
        toCamelCase = lambda string: re.sub("_(.)", lambda m: m.group(1).upper(), string.lower())
        res = {}
        for key in dic.keys():
            res[toCamelCase(key)] = dic[key]
        return res

    return {
        "smrDaily": [dicToCamelCase(smr) for smr in smr_daily],
        "smrMonthly": [dicToCamelCase(smr) for smr in smr_monthly],
    }
