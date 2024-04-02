import boto3
import common
from botocore.exceptions import ClientError
import traceback


def lambda_handler(event, _):
    args = event["arguments"]
    client = boto3.client("cognito-idp", region_name="ap-northeast-1")

    def add_to_group(group_name):
        res = client.admin_add_user_to_group(
            UserPoolId=common.user_pool_id, Username=args["username"], GroupName=group_name
        )

    try:
        try:
            # craete a user
            response = client.admin_create_user(
                UserPoolId=common.user_pool_id,
                Username=args["username"],
                UserAttributes=[
                    {"Name": "email", "Value": args["email"]},
                    {"Name": "email_verified", "Value": "True"},
                ],
            )
            if args["point"] > 0 and args["effective_days"] > 0:
                # add initial points
                sub = ""
                for attr in response["User"]["Attributes"]:
                    if attr["Name"] == "sub":
                        sub = attr["Value"]
                common.add_points(sub, args["point"], args["effective_days"])

            # add to groups
            add_to_group("privileged")
            add_to_group("active")
            if args["isAdmin"]:
                add_to_group("admin")
            return "Success"
        except ClientError as e:
            print(e.response)
            if e.response["Error"]["Code"] == "UsernameExistsException":
                return "UsernameExistsException"

            print(e.response["Error"]["Code"])
            print(e.response["Error"]["Message"])
            return e.response["Error"]["Message"]
    except Exception as e:
        print(f"{traceback.format_exc()}")
        return "unexpected error."
