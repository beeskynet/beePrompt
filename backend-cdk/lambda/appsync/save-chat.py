import json
from datetime import datetime
from pytz import timezone
import boto3
from common import table


def put_chat_to_db(userid, chatid, messages, title=None, sys_msg=None):
    # 更新前チャットデータ
    res = table.get_item(Key={"pk": "chat#%s" % userid, "sk": chatid})
    old = res["Item"] if "Item" in res else None
    # 新規/更新チャットデータ
    sys_msg_block = [{"role": "system", "content": sys_msg}] if sys_msg else []
    chat = sys_msg_block + [msg for msg in messages if msg["content"]]
    tm = str(datetime.now(timezone("Asia/Tokyo")))
    if not title:
        if old:
            title = old["title"]
        else:
            title = [msg for msg in messages if msg["role"] == "user"][0]["content"][:30]
    item = {
        "pk": "chat#%s" % userid,
        "sk": chatid,
        "dtype": "chat",
        "title": title,
        "chat": json.dumps(chat),
        "createdAt": old["createdAt"] if old else tm[:19],  # yyyy-mm-dd hh:mm:ss
        "updatedAt": tm[:19],  # yyyy-mm-dd hh:mm:ss
    }
    table.put_item(Item=item)


def lambda_handler(event, context):
    print(event)
    args = event["arguments"]
    userid = args["userid"]
    chatid = args["chatid"]
    messages = args["messages"]
    title = args["title"] if "sysMsg" in args else None
    sys_msg = args["sysMsg"] if "sysMsg" in args else None
    put_chat_to_db(userid, chatid, messages, title=title, sys_msg=sys_msg)
    return "Success"
