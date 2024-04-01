import boto3
import common


def lambda_handler(event, _):
    args = event["arguments"]

    client = boto3.client("cognito-idp", region_name="ap-northeast-1")
    response = client.admin_create_user(
        UserPoolId=common.user_pool_id,
        Username=args["username"],
        UserAttributes=[
            {"Name": "email", "Value": args["email"]},
            {"Name": "email_verified", "Value": "True"},
        ],
    )
    print(response)
    # TODO: error check
    return "Success"
