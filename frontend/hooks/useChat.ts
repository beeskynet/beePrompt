import { Message } from "../lib/store";

interface Dict<T> {
  [key: string]: T;
}

interface UseChatProps {
  isChatsDeleteMode: boolean;
  chatHistoryLastEvaluatedKey: string;
  setChatHistory: (callback: (chatHistory: Message[]) => Message[]) => void;
  setChatHistoryLastEvaluatedKey: (key: string) => void;
  fetchAppSync: (params: { query: string; variables?: Dict<any> }) => Promise<any>;
}

/**
 * チャット関連の機能を提供するカスタムフック
 * @param props - フックの依存関係
 * @returns チャット関連の機能をまとめたオブジェクト
 */
export const useChat = ({
  isChatsDeleteMode,
  chatHistoryLastEvaluatedKey,
  setChatHistory,
  setChatHistoryLastEvaluatedKey,
  fetchAppSync,
}: UseChatProps) => {
  /**
   * チャット履歴を取得する
   * @param isOnScroll スクロールによる追加取得かどうか
   */
  async function getChatHistory(isOnScroll: boolean = false) {
    if (isChatsDeleteMode && isOnScroll) return;
    if (isOnScroll && !chatHistoryLastEvaluatedKey) return;
    try {
      const query = `
      query($LastEvaluatedKey:String) {
        getChatIdList(LastEvaluatedKey: $LastEvaluatedKey) {
          chats {chatid title updatedAt }
          LastEvaluatedKey
        }
      }`;

      /*
          const variables = { userid };
          const data = await fetchAppSync({ query, variables });
          setChatHistory((chatHistory: Message[]) => {
            // 応答中チャットとDBから取得したチャット履歴をマージ
            const gotChatids = data.getChatIdList.map((chat: Message) => chat.chatid);
            const responding = chatHistory.filter((chat: Message) => chat.title === "...waiting AI response..." && !gotChatids.includes(chat.chatid));
            return data.getChatIdList ? [...responding, ...data.getChatIdList] : [...responding];
       */
      const variables = { LastEvaluatedKey: isOnScroll ? chatHistoryLastEvaluatedKey : null };
      const res = await fetchAppSync({ query, variables });
      setChatHistoryLastEvaluatedKey(res.getChatIdList.LastEvaluatedKey);
      const chats = res.getChatIdList.chats;
      setChatHistory((chatHistory: Message[]) => {
        if (isOnScroll) {
          return [...chatHistory, ...chats];
        } else {
          // 応答中チャットとDBから取得したチャット履歴をマージ
          const gotChatids = chats.map((chat: Message) => chat.chatid);
          const responding = chatHistory.filter((chat: Message) => chat.title === "...waiting AI response..." && !gotChatids.includes(chat.chatid));
          return chats ? [...responding, ...chats] : [...responding];
        }
      });
    } catch (e) {
      console.error("getChatHistory()", e);
    }
  }

  return {
    getChatHistory,
  };
};
