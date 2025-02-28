import { useSetAtom } from "jotai";
import { Chats, Message } from "lib/store";
import { AppAtoms } from "lib/store";
import { useState } from "react";

interface WebSocketMap {
  [key: string]: WebSocket;
}

interface Dict<T> {
  [key: string]: T;
}

interface UseWebSocketProps {
  setChats: (callback: (chats: Chats) => Chats) => void;
  saveChat: (chatid: string, messages: Message[], sysMsg: string | undefined) => Promise<void>;
  scrollToBottom: () => void;
  richChats: Chats;
  systemInputRef: React.MutableRefObject<string | undefined>;
}

/**
 * WebSocket関連の機能を提供するカスタムフック
 * @param props - WebSocketフックの依存関係
 * @returns WebSocket関連の機能をまとめたオブジェクト
 */
export const useWebSocket = ({ setChats, saveChat, scrollToBottom, richChats, systemInputRef }: UseWebSocketProps) => {
  const [websocketMap, setWebsocketMap] = useState<WebSocketMap>({});
  const setWaitingMap = useSetAtom(AppAtoms.waitingMap);

  /**
   * WebSocketからのメッセージを処理する
   * @param event - WebSocketのメッセージイベント
   */
  const onMessage = async (event: MessageEvent) => {
    if (!event.data || event.data.startsWith('{"message": "Endpoint request timed out"')) return; // httpリクエスト正常終了応答=event.dataブランク

    const cleanupWebSocket = (dtm: string | void) => {
      // 接続のクリーンナップ
      if (event.target && event.target instanceof WebSocket) event.target.close();
      setWebsocketMap((websocketMap: WebSocketMap) => {
        if (dtm && dtm in websocketMap) {
          delete websocketMap[dtm];
        }
        return websocketMap;
      });
    };

    try {
      const { content, dtm, chatid, userDtm, done, errorType, errorMessage } = JSON.parse(event.data);
      if (dtm === undefined) {
        console.error("想定外のレスポンス形式", event.data);
      } else if (content !== undefined) {
        // メッセージ追記
        setChats((chats: Chats) => {
          const messages = chats[chatid];
          const tgtAssMsg = messages.filter((msg: Message) => msg.role === "assistant" && dtm === msg.dtm);
          if (!tgtAssMsg.length) return chats;
          const origContent = tgtAssMsg[0].content;
          const updatedMsgs = messages.map((msg: Message) =>
            !(msg.role === "assistant" && dtm === msg.dtm)
              ? msg
              : { role: "assistant", model: msg.model, content: origContent === null ? content : origContent + content, dtm },
          );
          chats[chatid] = updatedMsgs;
          return chats;
        });
        scrollToBottom();
      } else if (done !== undefined) {
        // メッセージ終了
        setWaitingMap((waitingMap: WebSocketMap) => ({ ...waitingMap, [dtm]: 0 }));
        cleanupWebSocket(dtm);
        console.info(event.data); // 利用料等情報
        setChats((chats: Chats) => {
          const messages = chats[chatid];
          const updatedMsgs = messages.map((msg: Message) => (![dtm, userDtm].includes(msg.dtm) ? msg : { ...msg, done }));
          chats[chatid] = updatedMsgs;
          return chats;
        });
        await saveChat(chatid, richChats[chatid], systemInputRef.current);
      } else {
        const errorMessages: Dict<string> = {
          InvalidChatHistory: "不正なチャット履歴です。",
          LackOfPoints: "ポイントが不足しています。",
          OpenAIAPIError: errorMessage,
          AnthropicAPIError: errorMessage,
        };
        // エラー系
        setWaitingMap((waitingMap: WebSocketMap) => ({ ...waitingMap, [dtm]: 0 }));
        cleanupWebSocket(dtm);
        let chatErrorMessage: string;
        if (Object.keys(errorMessages).includes(errorType)) {
          chatErrorMessage = errorMessages[errorType];
        } else {
          console.error("想定外のレスポンス形式", event.data);
          chatErrorMessage = "An error happend.";
        }
        setChats((chats: Chats) => {
          const messages = chats[chatid];
          const updatedMsgs = messages.map((msg: Message) =>
            dtm !== msg.dtm || msg.role === "user" ? msg : { ...msg, content: chatErrorMessage, isError: true },
          );
          chats[chatid] = updatedMsgs;
          return chats;
        });
      }
    } catch (e) {
      cleanupWebSocket();
      console.error("parse response json error", e);
      console.error("event.data = ", event.data);
      alert("システムエラーが発生しました。");
    }
  };

  /**
   * すべてのWebSocket接続を切断する
   * @param pagesChatIdRef - 現在のチャットID
   */
  const disconnectAllWebSockets = (pagesChatIdRef: React.MutableRefObject<string>) => {
    // 全websocket接続を切断
    setWebsocketMap((websocketMap: WebSocketMap) => {
      Object.keys(websocketMap).forEach((dtm) => {
        websocketMap[dtm].close();
        delete websocketMap[dtm];
      });
      return {};
    });
    // 応答中状態を破棄
    setWaitingMap({});
    // 中断メッセージの表示(少しでも応答メッセージがあれば上書きはしない)
    setChats((chats: Chats) => {
      const messages = chats[pagesChatIdRef.current];
      const updatedMsgs = messages.map((msg) =>
        msg.role === "user" || msg.content ? msg : { ...msg, content: "応答の受信が中断されました。", isError: true },
      );
      chats[pagesChatIdRef.current] = updatedMsgs;
      return chats;
    });
  };

  /**
   * 新しいWebSocket接続を作成し、メッセージを送信する
   * @param wssUrl - WebSocketサーバーのURL
   * @param message - 送信するメッセージ
   * @param dtm - メッセージの日時識別子
   */
  const createWebSocketConnection = (wssUrl: string, message: string, dtm: string) => {
    const websocket = new WebSocket(wssUrl);
    setWebsocketMap((map: WebSocketMap) => {
      map[dtm] = websocket;
      return map;
    });
    websocket.onmessage = onMessage;
    websocket.onopen = () => websocket.send(message);
    return websocket;
  };

  return {
    disconnectAllWebSockets,
    createWebSocketConnection,
    websocketMap,
  };
};

