import { Chats, Message } from "lib/store";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { apiUrls } from "lib/environments";

interface SubmitParams {
  model: string;
  userDtm: string;
  userInput: string;
  systemInput: string;
  activeChatId: string;
  richChats: Chats;
  setChats: (callback: (chats: Chats) => Chats) => void;
  createWebSocketConnection: (wssUrl: string, message: string, dtm: string) => WebSocket;
  temperature: {
    gpt: number;
    claude: number;
    cohere: number;
  };
  penalties: {
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };
}

/**
 * メッセージ送信機能を提供するカスタムフック
 * @returns メッセージ送信関連の機能をまとめたオブジェクト
 */
export const useSubmit = () => {
  /**
   * メッセージを送信する
   * @param params - 送信に必要なパラメータ
   */
  const submit = async ({
    model,
    userDtm,
    userInput,
    systemInput,
    activeChatId,
    richChats,
    setChats,
    createWebSocketConnection,
    temperature,
    penalties,
  }: SubmitParams) => {
    try {
      const dtm = new Date().toISOString();
      setChats((chats: Chats) => {
        const messages = chats[activeChatId];
        chats[activeChatId] = [...messages, { role: "assistant", model: model, content: null, dtm }];
        return chats;
      });

      // メッセージ送信
      const session = await fetchAuthSession();
      if (!session.tokens) {
        alert("セッションが終了しました。ログインしてください。");
        signOut();
        return;
      }
      const jwt = session.tokens.accessToken.toString();
      const prm = JSON.stringify({
        sysMsg: systemInput,
        userMsg: userInput,
        temperatureGpt: temperature.gpt,
        topPGpt: penalties.topP,
        frequencyPenaltyGpt: penalties.frequencyPenalty,
        presencePenaltyGpt: penalties.presencePenalty,
        temperatureClaude: temperature.claude,
        temperatureCohere: temperature.cohere,
        messages: richChats[activeChatId].map((msg: Message) => ({
          role: msg.role,
          dtm: msg.dtm,
          model: msg.model,
          content: msg.content,
          done: msg.done,
        })),
        model: model,
        chatid: activeChatId,
        dtm,
        userDtm,
        jwt,
      });
      
      createWebSocketConnection(apiUrls.wss, prm, dtm);
    } catch (error: unknown) {
      console.error("submit error", error);
      if (error instanceof Error) alert(error.message);
    }
  };

  return { submit };
}; 