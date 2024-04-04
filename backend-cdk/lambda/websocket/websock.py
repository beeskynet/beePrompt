from anthropic import Anthropic
import anthropic
from openai import OpenAI
import tiktoken  # pyright: ignore[reportMissingImports]
import json
import boto3
import tiktoken  # pyright: ignore[reportMissingImports]
import inspect
import os
import traceback
from common import (
    access_db_retry,
    save_usage,
    use_points,
    yen_1dollar,
    point_1yen,
    check_enough_points,
    Model,
    PRICE,
    validate_token,
)
from typing import List, Dict

API_KEY_SECRED_KEY = {
    "openai": "beePrompt-open-ai-secret",
    "anthropic": "beePrompt-anthropic-secret",
}
API_KEY_ENV_NAME = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}

CLAUDE_MAX_OUTPUT_TOKENS = 4096  # 2024/4/1現在、全モデルの最大値= 4096
"""
https://docs.anthropic.com/claude/reference/messages_post
https://docs.anthropic.com/claude/docs/models-overview
"""


def location(depth=1):
    frame = inspect.stack()[depth]
    return str((os.path.basename(frame.filename), frame.function, frame.lineno))


class InputError(Exception):
    pass


def lambda_handler(event, _):
    def api_key(platform):
        value = os.environ.get(API_KEY_ENV_NAME[platform])
        if value:
            return value
        session = boto3.session.Session()
        client = session.client(service_name="secretsmanager", region_name="ap-northeast-1")
        secret_json = client.get_secret_value(SecretId=API_KEY_SECRED_KEY[platform])
        return json.loads(secret_json["SecretString"])[API_KEY_SECRED_KEY[platform]]

    def init_anthropic():
        return Anthropic(api_key=api_key("anthropic"))

    def init_openai():
        return OpenAI(api_key=api_key("openai"))

    def count_token(text):
        # Claudeの呼び出し前入力トークン数算出もGPT用のもので代用
        # ライブラリバージョンアップにより下記が廃止になったため。
        # client = Anthropic()
        # client.count_tokens(text)
        encoding = tiktoken.get_encoding("cl100k_base")
        token_integers = encoding.encode(text)
        return len(token_integers)

    def is_gpt(model):
        return model.startswith("gpt-")

    def est_cost_claude(io_type, token_cnt, model):
        dollar_1token = PRICE[model][io_type]
        dollar = token_cnt * dollar_1token / 1000
        yen = dollar * float(yen_1dollar)
        usage_point = yen * float(point_1yen)
        return {
            f"{io_type}_token": token_cnt,
            f"{io_type}_dollar": "%.5f" % dollar,
            f"{io_type}_yen": "%.3f" % yen,
            f"{io_type}_usage_point": "%.3f" % usage_point,
        }

    def est_gpt_cost(io_type, message, model=Model.gpt35turbo.value):
        # messages example: input message -> [{ 'role': 'system': 'content': 'xxx' }, { 'role': 'user', 'content': 'xxx'}]
        #                  output message -> 'xxx'
        def count_input_token(input_msgs):
            val = 0
            adjust = 7
            vals = [val + count_token(msg["content"]) + adjust for msg in input_msgs]
            return sum(vals)

        token_cnt = count_input_token(message) if io_type == "in" else count_token(message)
        dollar = token_cnt * PRICE[model][io_type] / 1000
        yen = dollar * float(yen_1dollar)
        usage_point = yen * float(point_1yen)
        return {
            f"{io_type}_token": token_cnt,
            f"{io_type}_dollar": "%.5f" % dollar,
            f"{io_type}_yen": "%.3f" % yen,
            f"{io_type}_usage_point": "%.3f" % usage_point,
        }

    domain_name = event.get("requestContext", {}).get("domainName")
    stage = event.get("requestContext", {}).get("stage")
    connectionId = event.get("requestContext", {}).get("connectionId")
    body = json.loads(event.get("body", {}))
    token = body["jwt"]
    dtm = body["dtm"]
    userDtm = body["userDtm"]
    userMsg = body["userMsg"]
    sysMsg = body["sysMsg"]
    temperatureGpt = float(body["temperatureGpt"])
    topPGpt = float(body["topPGpt"])
    frequencyPenaltyGpt = float(body["frequencyPenaltyGpt"])
    presencePenaltyGpt = float(body["presencePenaltyGpt"])
    temperatureClaude = float(body["temperatureClaude"])
    # topPClaude = float(body["topPClaude"])
    # topKClaude = int(body["topKClaude"])
    messages = body["messages"]
    model = body["model"]
    chatid = body["chatid"]
    print(model)

    apigw_management = boto3.client("apigatewaymanagementapi", endpoint_url=f"https://{domain_name}/{stage}")
    try:
        # トークン検証
        res_vali = validate_token(token, dtm)
        if not res_vali["success"]:
            apigw_management.post_to_connection(
                ConnectionId=connectionId,
                Data=json.dumps({**res_vali["error-response"], "chatid": chatid, "dtm": dtm}),
            )
            return {"statusCode": 403, "body": res_vali["error-response"]}
        userid = res_vali["access_token"]["sub"]

        # API入力用メッセージ
        def user_1assistant_list(messages) -> List[Dict[str, Dict[str, str]]]:
            """1つのuserメッセージに対して1つのassistantメッセージに絞る"""
            error_response = {
                "error": "Invalid chat history",
                "errorCode": "InvalidChatHistory",
            }
            # 1 user x N assistants
            user_assistants_list = []
            for msg in messages:
                if "done" not in msg:
                    continue
                if msg["role"] == "user":
                    user_assistants_list.append({"user": msg})
                elif msg["role"] == "assistant":
                    if len(user_assistants_list) == 0:
                        # チャット履歴の先頭がassistantメッセージ
                        raise InputError(error_response)
                    if "assistants" in user_assistants_list[-1]:
                        user_assistants_list[-1]["assistants"].append(
                            {**msg, "price_in_out": PRICE[msg["model"]]["in"] + PRICE[msg["model"]]["out"]}
                        )
                    else:
                        user_assistants_list[-1]["assistants"] = [
                            {**msg, "price_in_out": PRICE[msg["model"]]["in"] + PRICE[msg["model"]]["out"]}
                        ]
            # 1 user x 1 assistant
            user_1assistant_list = []
            for user_assistants in user_assistants_list:
                if "user" not in user_assistants or "assistants" not in user_assistants:
                    # assistantメッセージに対してuserメッセージが存在しない(その場合おそらくここまで到達しない)
                    # userメッセージに対してassistantメッセージが存在しない
                    raise InputError(error_response)
                user_1assistant_list.append(
                    {
                        "user": user_assistants["user"],
                        # 1トークンあたりの利用料が一番高いassistantメッセージを採用
                        "assistant": sorted(user_assistants["assistants"], key=lambda x: x["price_in_out"])[-1],
                    }
                )
            return user_1assistant_list

        mid_msgs = []
        for user_1assistant in user_1assistant_list(messages):
            user_msg = user_1assistant["user"]
            assistant_msg = user_1assistant["assistant"]
            mid_msgs.append({"role": user_msg["role"], "content": user_msg["content"]})
            mid_msgs.append({"role": assistant_msg["role"], "content": assistant_msg["content"]})
        sys_msg = [{"role": "system", "content": sysMsg}] if is_gpt(model) else []
        in_msgs = sys_msg + mid_msgs + [{"role": "user", "content": userMsg}]

        # ポイントチェック
        pre_in_costs = est_gpt_cost("in", in_msgs, model)

        res_vali = check_enough_points(userid, pre_in_costs["in_usage_point"])
        if not res_vali["success"]:
            apigw_management.post_to_connection(
                ConnectionId=connectionId,
                Data=json.dumps({**res_vali["error-response"], "chatid": chatid, "dtm": dtm}),
            )
            return {"statusCode": 400, "body": res_vali["error-response"]}

        # モデル呼び出し
        output_tokens = None  # for Claude
        input_tokens = None  # for Claude
        whole_content = ""  # for GPT
        if is_gpt(model):
            # gpt
            client = init_openai()
            stream = client.chat.completions.create(
                model=model,
                messages=in_msgs,  # pyright: ignore[reportGeneralTypeIssues]
                stream=True,
                user=userid,
                temperature=temperatureGpt,
                top_p=topPGpt,
                frequency_penalty=frequencyPenaltyGpt,
                presence_penalty=presencePenaltyGpt,
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    whole_content = whole_content + content
                    apigw_management.post_to_connection(
                        ConnectionId=connectionId, Data=json.dumps({"content": content, "chatid": chatid, "dtm": dtm})
                    )
        else:
            # claude
            client = init_anthropic()
            with client.messages.stream(
                max_tokens=CLAUDE_MAX_OUTPUT_TOKENS,
                messages=in_msgs,
                model=model,
                temperature=temperatureClaude,
                metadata={"user_id": userid},
                # top_k=topKClaude,
                # top_p=topPClaude,
            ) as stream:
                for event in stream:
                    if event.type == "content_block_delta":
                        apigw_management.post_to_connection(
                            ConnectionId=connectionId,
                            Data=json.dumps({"content": event.delta.text, "chatid": chatid, "dtm": dtm}),
                        )
                    if event.type == "message_delta":
                        output_tokens = event.usage.output_tokens
                # メッセージ終了
                input_tokens = stream.get_final_message().usage.input_tokens
        # 入力利用量登録
        in_costs = pre_in_costs if is_gpt(model) else est_cost_claude("in", input_tokens, model)
        access_db_retry(save_usage, {"userid": userid, "io_type": "in", "model": model, "io_costs": in_costs})
        # 出力利用量登録
        out_costs = (
            est_gpt_cost("out", whole_content, model)
            if is_gpt(model)
            else est_cost_claude("out", output_tokens, model)
        )
        access_db_retry(save_usage, {"userid": userid, "io_type": "out", "model": model, "io_costs": out_costs})

        # ポイント使用
        total_usage_point = float(in_costs["in_usage_point"]) + float(out_costs["out_usage_point"])
        access_db_retry(use_points, {"userid": userid, "points_to_use": total_usage_point})
        # クライアントにメッセージ終了通知
        apigw_management.post_to_connection(
            ConnectionId=connectionId,
            Data=json.dumps(
                {
                    "done": "message is ended.",
                    "chatid": chatid,
                    "model": model,
                    "dtm": dtm,
                    "userDtm": userDtm,
                    **in_costs,
                    **out_costs,
                    "total_yen": "%.3f" % (float(in_costs["in_yen"]) + float(out_costs["out_yen"])),
                    "total_usage_point": "%.3f" % total_usage_point,
                }
            ),
        )
        return {"statusCode": 200}
    except InputError as e:
        error_response = e.args[0]
        apigw_management.post_to_connection(
            ConnectionId=connectionId,
            Data=json.dumps(
                {
                    **error_response,
                    "chatid": chatid,
                    "dtm": dtm,
                }
            ),
        )
        return {"statusCode": 400, "body": error_response}
    except Exception as e:
        print(f"{traceback.format_exc()}{location()}")
        apigw_management.post_to_connection(
            ConnectionId=connectionId, Data=json.dumps({"error": traceback.format_exc(), "chatid": chatid, "dtm": dtm})
        )
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "trace": traceback.format_exc(), "chatid": chatid, "dtm": dtm}),
        }
