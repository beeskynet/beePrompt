import json
import boto3
import re
import os
from boto3.dynamodb.conditions import Key, Attr
from pytz import timezone
from datetime import datetime, timedelta
import common

client = boto3.client("dynamodb", region_name="ap-northeast-1")
dynamodb = boto3.resource("dynamodb")
table_name = common.table_name
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    userid = event["arguments"]["userid"]
    points_to_add = event["arguments"]["point"]
    effective_days = event["arguments"]["effective_days"]

    def use_point(userid, points_to_use):
        if points_to_use < 0:
            raise Exception("use_point()のpoints_to_useはマイナス値不可:points_to_add=%f" % points_to_use)

        def get_effective_balance(userid):
            """有効残高を取得"""
            response = table.query(
                KeyConditionExpression=Key("pk").eq("pt#%s" % userid)
                & Key("sk").gt(str(datetime.now(timezone("Asia/Tokyo")))),
                ScanIndexForward=True,
            )
            return [item for item in response["Items"] if item["balance"] > 0]

        effective_balances = get_effective_balance(userid)

        # 一括更新内容を作成
        TransactItems = []
        if len(effective_balances) == 0:
            # 残高レコードがない ※API利用時にはありえない
            # 残高付与登録
            expiryDate = str(datetime.now(timezone("Asia/Tokyo")) + timedelta(days=365))[:25]
            now = datetime.now(timezone("Asia/Tokyo"))
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "pt#%s" % userid},
                            "sk": {"S": expiryDate},
                            "balance": {"N": str(-points_to_use)},
                            "createdAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                            "updatedAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
            # ポイント残高更新ログ
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "ptlog#%s" % userid},
                            "sk": {"S": "%s#%s" % (expiryDate, str(datetime.now(timezone("Asia/Tokyo")))[:25])},
                            "balance": {"N": str(-points_to_use)},
                            "additionalPoints": {"N": str(-points_to_use)},
                            "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
        for effe_balance in effective_balances:

            def append_use_balance_item_to_transact(TransactItems, effe_balance):
                new_balance = effe_balance["balance"] - points_to_use
                TransactItems.append(
                    {
                        "Update": {
                            "TableName": table_name,
                            "Key": {"pk": {"S": "pt#%s" % userid}, "sk": {"S": effe_balance["sk"]}},
                            "ConditionExpression": "balance = :orig_balance",
                            "UpdateExpression": "SET balance = :new_balance, updatedAt = :updatedAt",
                            "ExpressionAttributeValues": {
                                ":orig_balance": {"N": str(effe_balance["balance"])},
                                ":new_balance": {"N": str(new_balance)},
                                ":updatedAt": {
                                    "S": str(datetime.now(timezone("Asia/Tokyo")))[:19]
                                },  # yyyy-mm-dd hh:mm:ss
                            },
                        },
                    }
                )
                TransactItems.append(
                    {
                        "Put": {
                            "TableName": table_name,
                            "Item": {
                                "pk": {"S": "ptlog#%s" % userid},
                                "sk": {
                                    "S": "%s#%s" % (effe_balance["sk"], str(datetime.now(timezone("Asia/Tokyo")))[:25])
                                },
                                "balance": {"N": str(new_balance)},
                                "additionalPoints": {"N": str(-points_to_use)},
                                "createdAt": {
                                    "S": str(datetime.now(timezone("Asia/Tokyo")))[:19]
                                },  # yyyy-mm-dd hh:mm:ss
                            },
                        }
                    }
                )
                return TransactItems

            def append_delete_balance_item_to_transact(TransactItems, effe_balance):
                TransactItems.append(
                    {
                        "Delete": {
                            "TableName": table_name,
                            "Key": {"pk": {"S": "pt#%s" % userid}, "sk": {"S": effe_balance["sk"]}},
                            "ConditionExpression": "balance = :orig_balance",
                            "ExpressionAttributeValues": {":orig_balance": {"N": str(effe_balance["balance"])}},
                        },
                    }
                )
                TransactItems.append(
                    {
                        "Put": {
                            "TableName": table_name,
                            "Item": {
                                "pk": {"S": "ptlog#%s" % userid},
                                "sk": {
                                    "S": "%s#%s" % (effe_balance["sk"], str(datetime.now(timezone("Asia/Tokyo")))[:25])
                                },
                                "balance": {"N": "0"},
                                "additionalPoints": {"N": str(-effe_balance["balance"])},
                                "createdAt": {
                                    "S": str(datetime.now(timezone("Asia/Tokyo")))[:19]
                                },  # yyyy-mm-dd hh:mm:ss
                            },
                        }
                    }
                )
                return TransactItems

            if effe_balance["balance"] > points_to_use:
                # 残高から利用ポイントを引いて終了
                TransactItems = append_use_balance_item_to_transact(TransactItems, effe_balance)
                break
            elif effe_balance["balance"] == points_to_use:
                # 残高=利用ポイント→0  ※ほぼありえない
                TransactItems = append_delete_balance_item_to_transact(TransactItems, effe_balance)
                break
            elif effe_balance["balance"] < points_to_use:
                if effe_balance["sk"] == effective_balances[-1]["sk"]:
                    # 最新レコード: マイナス残高に更新して終了
                    TransactItems = append_use_balance_item_to_transact(TransactItems, effe_balance)
                else:
                    # 非最新レコード: 残高レコードを削除し、利用ポイントから残高レコードの残高を引いて継続
                    TransactItems = append_delete_balance_item_to_transact(TransactItems, effe_balance)
                    points_to_use -= effe_balance["balance"]
        client.transact_write_items(TransactItems=TransactItems)

    def add_point(userid, points_to_add, effective_days):
        if points_to_add < 0:
            raise Exception("add_point()のpoints_to_addはマイナス値不可:points_to_add=%f" % points_to_add)

        def get_negative_balance(userid):
            """マイナス残高を取得"""
            response = table.query(KeyConditionExpression=Key("pk").eq("pt#%s" % userid), ScanIndexForward=True)
            items = response["Items"]
            negative_balances = [item for item in items if item["balance"] < 0]
            return negative_balances

        negative_balances = get_negative_balance(userid)

        # 一括更新内容を作成
        TransactItems = []
        for nega_balance in negative_balances:
            if points_to_add >= -nega_balance["balance"]:
                # マイナス残高を相殺->残高なし
                TransactItems.append(
                    {
                        "Delete": {
                            "TableName": table_name,
                            "Key": {"pk": {"S": "pt#%s" % userid}, "sk": {"S": nega_balance["sk"]}},
                            "ConditionExpression": "balance = :orig_balance",
                            "ExpressionAttributeValues": {":orig_balance": {"N": str(nega_balance["balance"])}},
                        },
                    }
                )
                TransactItems.append(
                    {
                        "Put": {
                            "TableName": table_name,
                            "Item": {
                                "pk": {"S": "ptlog#%s" % userid},
                                "sk": {
                                    "S": "%s#%s" % (nega_balance["sk"], str(datetime.now(timezone("Asia/Tokyo")))[:25])
                                },
                                "balance": {"N": "0"},
                                "additionalPoints": {"N": str(-nega_balance["balance"])},
                                "createdAt": {
                                    "S": str(datetime.now(timezone("Asia/Tokyo")))[:19]
                                },  # yyyy-mm-dd hh:mm:ss
                            },
                        }
                    }
                )
                points_to_add += nega_balance["balance"]
            else:
                # マイナス残高を相殺->残高あり
                new_balance = nega_balance["balance"] + points_to_add
                TransactItems.append(
                    {
                        "Update": {
                            "TableName": table_name,
                            "Key": {"pk": {"S": "pt#%s" % userid}, "sk": {"S": nega_balance["sk"]}},
                            "ConditionExpression": "balance = :orig_balance",
                            "UpdateExpression": "SET balance = :new_balance, updatedAt = :updatedAt",
                            "ExpressionAttributeValues": {
                                ":orig_balance": {"N": str(nega_balance["balance"])},
                                ":new_balance": {"N": str(new_balance)},
                                ":updatedAt": {
                                    "S": str(datetime.now(timezone("Asia/Tokyo")))[:19]
                                },  # yyyy-mm-dd hh:mm:ss
                            },
                        },
                    }
                )
                TransactItems.append(
                    {
                        "Put": {
                            "TableName": table_name,
                            "Item": {
                                "pk": {"S": "ptlog#%s" % userid},
                                "sk": {
                                    "S": "%s#%s" % (nega_balance["sk"], str(datetime.now(timezone("Asia/Tokyo")))[:25])
                                },
                                "balance": {"N": str(new_balance)},
                                "additionalPoints": {"N": str(points_to_add)},
                                "createdAt": {
                                    "S": str(datetime.now(timezone("Asia/Tokyo")))[:19]
                                },  # yyyy-mm-dd hh:mm:ss
                            },
                        }
                    }
                )
                points_to_add = 0
                break
        if points_to_add > 0:
            # ポイント付与
            now = datetime.now(timezone("Asia/Tokyo"))
            expiryDate = str(now + timedelta(days=effective_days))[:25]  # 有効期限(yyyy-mm-dd hh:mm:ss.sssss)
            # 残高付与登録
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "pt#%s" % userid},
                            "sk": {"S": expiryDate},
                            "balance": {"N": str(points_to_add)},
                            "createdAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                            "updatedAt": {"S": str(now)[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
            # ポイント残高更新ログ
            TransactItems.append(
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "pk": {"S": "ptlog#%s" % userid},
                            "sk": {"S": "%s#%s" % (expiryDate, str(datetime.now(timezone("Asia/Tokyo")))[:25])},
                            "balance": {"N": str(points_to_add)},
                            "additionalPoints": {"N": str(points_to_add)},
                            "createdAt": {"S": str(datetime.now(timezone("Asia/Tokyo")))[:19]},  # yyyy-mm-dd hh:mm:ss
                        },
                    }
                }
            )
        client.transact_write_items(TransactItems=TransactItems)

    if points_to_add < 0:
        use_point(userid, abs(points_to_add))
    elif points_to_add > 0:
        add_point(userid, points_to_add, effective_days)
    return "Success"
