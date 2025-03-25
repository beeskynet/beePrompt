import { useSetAtom, useAtom, useAtomValue } from "jotai";
import { Chats, Message } from "lib/store";
import { AppAtoms } from "lib/store";
import { useState, useEffect, useCallback, useRef } from "react";
import { useChat } from "./useChat";
import { getDefaultStore } from "jotai";

interface WebSocketMap {
  [key: string]: WebSocket;
}

interface Dict<T> {
  [key: string]: T;
}

interface UseWebSocketProps {
  systemInputRef: React.MutableRefObject<string | undefined>;
}

/**
 * WebSocket関連の機能を提供するカスタムフック
 * @param props - WebSocketフックの依存関係
 * @returns WebSocket関連の機能をまとめたオブジェクト
 */
export const useWebSocket = ({ systemInputRef }: UseWebSocketProps) => {
  const [websocketMap, setWebsocketMap] = useState<WebSocketMap>({});
  const setWaitingMap = useSetAtom(AppAtoms.waitingMap);
  const [richChats] = useAtom(AppAtoms.richChats);
  // useAtomValueを使用してレンダリング時のautoScroll値を取得
  const autoScroll = useAtomValue(AppAtoms.autoScroll);
  const { saveChat, updateChats: setChats } = useChat();
  
  // 自動スクロール実行中かどうかを示すフラグ
  const isAutoScrollingRef = useRef<boolean>(false);
  // ユーザーが明示的に上へスクロールしたことを示すフラグ
  const userScrolledUpRef = useRef<boolean>(false);
  // スクロール位置判定の許容差分（px）
  const SCROLL_BOTTOM_THRESHOLD = 20;
  
  // autoScrollの値の変化を監視
  useEffect(() => {
    // autoScrollがfalseになったとき、ユーザーが上へスクロールしたことを記録
    if (!autoScroll) {
      userScrolledUpRef.current = true;
    } else {
      userScrolledUpRef.current = false;
    }
  }, [autoScroll]);
  
  /**
   * スクロールをページ下部に移動する関数
   * autoScrollがtrueの場合のみスクロールを実行する
   */
  const scrollToBottom = useCallback(() => {
    // 現在のautoScroll値を直接取得（フック外で使用するため）
    const store = getDefaultStore();
    const currentAutoScroll = store.get(AppAtoms.autoScroll);
    
    // ユーザーがスクロールアップしていて、autoScrollがfalseの場合はスクロールしない
    if (userScrolledUpRef.current && !currentAutoScroll) {
      return;
    }
    
    // autoScrollがfalseの場合はスクロールしない（上記の条件に合致しない場合）
    if (!currentAutoScroll) {
      return;
    }
    
    setTimeout(() => {
      // 自動スクロールフラグを立てる（手動スクロールと区別するため）
      isAutoScrollingRef.current = true;
      
      const messagesContainer = document.querySelector("#messages-container");
      if (messagesContainer) {
        messagesContainer.scrollTo(0, messagesContainer.scrollHeight);
        
        // 自動スクロール完了後、少し遅れてフラグをOFFにする
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 100);
      } else {
        isAutoScrollingRef.current = false;
      }
    }, 0);
  }, []); // 依存配列を空にし、毎回最新の状態を取得

  /**
   * コンテナが最下部にあるかどうかを判定する関数
   * 厳密な等価ではなく、余裕を持たせた判定を行う
   */
  const isScrolledToBottom = (el: HTMLElement) => {
    const scrollBottom = el.scrollHeight - el.scrollTop;
    // 閾値を拡大（20px以内なら最下部とみなす）
    const isAtBottom = Math.abs(scrollBottom - el.clientHeight) < SCROLL_BOTTOM_THRESHOLD;
    return isAtBottom;
  };

  /**
   * WebSocketからのメッセージを処理する
   * @param event - WebSocketのメッセージイベント
   */
  const onMessage = useCallback(async (event: MessageEvent) => {
    if (!event.data || event.data.startsWith('{"message": "Endpoint request timed out"')) return; // httpリクエスト正常終了応答=event.dataブランク

    // 現在の処理で使用されるautoScroll値をリアルタイムに取得
    const store = getDefaultStore();
    const currentAutoScroll = store.get(AppAtoms.autoScroll); // リアルタイムにautoScroll値を取得

    // メッセージ処理前のスクロール位置をチェック
    const messagesContainer = document.querySelector("#messages-container");
    let wasAtBottom = false;
    if (messagesContainer) {
      wasAtBottom = isScrolledToBottom(messagesContainer as HTMLElement);
    }

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
        
        // スクロール実行直前のautoScroll状態を再度確認
        const finalAutoScroll = store.get(AppAtoms.autoScroll);
        
        // ユーザーが手動スクロールしていない場合のみスクロール
        // 1. ユーザーが上へスクロールしていない
        // 2. autoScrollがtrueまたは元々最下部にいた
        if (!userScrolledUpRef.current && (finalAutoScroll || wasAtBottom)) {
          // 自動スクロールを有効化する条件 - 最下部にいる場合のみ
          if (wasAtBottom && !finalAutoScroll) {
            store.set(AppAtoms.autoScroll, true);
          }
        
          scrollToBottom();
        }
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
  }, [setChats, setWaitingMap, setWebsocketMap, saveChat, richChats, scrollToBottom]); // autoScrollは依存配列から削除し、毎回直接取得する

  /**
   * 新しいWebSocket接続を作成し、メッセージを送信する
   * @param wssUrl - WebSocketサーバーのURL
   * @param message - 送信するメッセージ
   * @param dtm - メッセージの日時識別子
   */
  const createWebSocketConnection = useCallback((wssUrl: string, message: string, dtm: string) => {
    // メッセージ送信時は自動的にスクロールを有効にする
    // ユーザーが新しいメッセージを送ったので、ユーザーは最新のレスポンスを見たいはず
    userScrolledUpRef.current = false;
    getDefaultStore().set(AppAtoms.autoScroll, true);
    
    const websocket = new WebSocket(wssUrl);
    setWebsocketMap((map: WebSocketMap) => {
      map[dtm] = websocket;
      return map;
    });
    websocket.onmessage = onMessage;
    websocket.onopen = () => websocket.send(message);
    return websocket;
  }, [onMessage, setWebsocketMap]);

  /**
   * すべてのWebSocket接続を切断する
   * @param activeChatId - 現在のチャットID
   */
  const disconnectAllWebSockets = useCallback((activeChatId: string) => {
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
      const messages = chats[activeChatId];
      const updatedMsgs = messages.map((msg) =>
        msg.role === "user" || msg.content ? msg : { ...msg, content: "応答の受信が中断されました。", isError: true },
      );
      chats[activeChatId] = updatedMsgs;
      return chats;
    });
  }, [setWebsocketMap, setWaitingMap, setChats]);

  // ユーザーが明示的にスクロールアップしたことを記録する関数（外部から呼び出し用）
  const setUserScrolledUp = useCallback((value: boolean) => {
    userScrolledUpRef.current = value;
  }, []);

  return {
    disconnectAllWebSockets,
    createWebSocketConnection,
    websocketMap,
    scrollToBottom,
    isAutoScrollingRef,
    userScrolledUpRef,
    setUserScrolledUp,
  };
};

