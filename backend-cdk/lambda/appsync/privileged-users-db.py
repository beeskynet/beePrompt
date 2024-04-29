import json
import boto3
import json
import common


dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    try:
        res = table.get_item(Key={"pk": "privileged-users", "sk": "privileged-users"})
        return json.loads(res["Item"]["users"])
    except Exception as e:
        raise Exception("privileged-users-db Error:", e)
