import boto3
import common

client = boto3.client("dynamodb", region_name="ap-northeast-1")
dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, _):
    userids = event["arguments"]["userids"]
    points_to_add = event["arguments"]["point"]
    effective_days = event["arguments"]["effective_days"]

    for userid in userids:
        if points_to_add < 0:
            common.use_points(userid, abs(points_to_add))
        elif points_to_add > 0:
            common.add_points(userid, points_to_add, effective_days)
    return "Success"
