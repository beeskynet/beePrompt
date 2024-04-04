import boto3
import common

client = boto3.client("cognito-idp", region_name="ap-northeast-1")


def lambda_handler(event, _):
    usernames = event["arguments"]["usernames"]

    for username in usernames:
        res = client.admin_delete_user(
            UserPoolId=common.user_pool_id,
            Username=username,
        )
    return "Success"
