import { useAtom } from "jotai";
import { AppAtoms, Message, Chats } from "lib/store";
import { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { apiUrls } from "lib/environments";

interface Dict<T> {
  [key: string]: T;
}

/**
 * チャット関連の機能を提供するカスタムフック
 * @returns チャット関連の機能をまとめたオブジェクト
 */
export const useChat = () => {
  // useState で内部状態を管理
  const [chatHistoryLastEvaluatedKey, setChatHistoryLastEvaluatedKey] = useState<string>("");
  
  // 必要な状態を直接フック内で取得
  const [isChatsDeleteMode, _setIsChatsDeleteMode] = useAtom(AppAtoms.isChatsDeleteMode);
  const [_chatHistory, setChatHistory] = useAtom(AppAtoms.chatHistory);
  const [_frontChat, setFrontChat] = useAtom(AppAtoms.frontChat);
  const [richChats, setRichChats] = useAtom(AppAtoms.richChats);
  const [pagesChatId, setPagesChatIdState] = useAtom(AppAtoms.chatid);
  const [_isMessageDeleteMode, setIsMessageDeleteMode] = useAtom(AppAtoms.isMessageDeleteMode);
  const [sidebarDisplayChange, _setSidebarDisplayChange] = useAtom(AppAtoms.sidebarDisplayChange);
  
  // 現在表示中のチャットIDを管理するref
  const pagesChatIdRef = useRef<string>("");
  
  // router を直接フック内で取得
  const router = useRouter();
  const pathname = usePathname();

  /**
   * チャットIDを設定する関数
   * @param newChatid 新しいチャットID
   */
  const setPagesChatId = (newChatid: string) => {
    pagesChatIdRef.current = newChatid;
    setPagesChatIdState(newChatid);
    // チャットIDが変更されたらfrontChatも更新
    if (richChats[newChatid]) {
      setFrontChat(JSON.parse(JSON.stringify(richChats[newChatid])));
    }
  };

  /**
   * 新しいチャットを作成する
   * @returns 作成したチャットのID
   */
  const newChat = () => {
    setIsMessageDeleteMode(false);
    const uuid = self.crypto.randomUUID();

    // 新しいチャットIDでリッチチャットを空に初期化
    const newRichChats = {...richChats};
    newRichChats[uuid] = [];
    setRichChats(newRichChats);
    
    // フロントチャットを明示的に空にする
    setFrontChat([]);
    
    // チャットIDを設定
    setPagesChatId(uuid);
    
    // URLを更新
    if (pathname === "/") {
      router.replace(`/?c=${uuid}`);
    } else {
      router.push(`/?c=${uuid}`);
    }
    
    // モバイル画面の場合、サイドバーを非表示にする
    if (!window.matchMedia("(min-width: 768px)").matches && sidebarDisplayChange) {
      sidebarDisplayChange(false);
    }
    
    return uuid;
  };

  /**
   * チャットの状態を更新する関数
   * @param func 現在のチャット状態を受け取り、新しいチャット状態を返す関数
   */
  const updateChats = (func: Function) => {
    const newRichChats = func(richChats);
    setRichChats(newRichChats);
    setFrontChat(JSON.parse(JSON.stringify(newRichChats[pagesChatId] || [])));
  };

  /**
   * 指定されたチャットIDのメッセージを空にする
   * @param chatid チャットID
   */
  const setChatsEmptyMessages = (chatid: string) => {
    updateChats((chats: Chats) => {
      chats[chatid] = [];
      return chats;
    });
  };

  /**
   * AppSync APIを呼び出す関数
   * @param param0 クエリと変数
   * @returns APIレスポンス
   */
  const fetchAppSync = async ({
    query,
    variables,
  }: {
    query: string;
    variables?: Dict<string | number | boolean | Message[] | string[] | null | undefined>;
  }) => {
    const session = await fetchAuthSession();
    const res = await fetch(apiUrls.appSync, {
      method: "POST",
      headers: session.tokens?.accessToken ? { Authorization: session.tokens.accessToken.toString() } : undefined,
      body: JSON.stringify({ query, variables }),
    });
    const resJson = await res.json();
    if (resJson.errors) {
      console.error(resJson.errors[0].message, resJson.errors);
      throw "AppSync error.";
    }
    return resJson?.data;
  };

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

  /**
   * チャットを保存する
   */
  const saveChat = async (chatid: string, messages: Message[], sysMsg: string | undefined, title = "") => {
    if (!messages || messages.length === 0) return;
    try {
      const query = `
        mutation($chatid:String!, $messages:[MessageInput]!, $title:String, $sysMsg:String) {
          putChat(chatid: $chatid, sysMsg: $sysMsg, title: $title, messages: $messages)
        }`;

      const variables = { chatid, messages: messages.filter((msg: Message) => !msg.isError), sysMsg, title };

      await fetchAppSync({ query, variables });
      // チャット履歴リスト更新
      await getChatHistory();
    } catch (e) {
      console.error("save chat error", e);
    }
  };

  /**
   * 指定されたチャットを削除する
   */
  const deleteChats = async (chatids: string[]) => {
    try {
      // チャット削除
      const query = `
        mutation($chatids:[String]!) {
          deleteChats(chatids: $chatids)
        }`;
      const variables = { chatids };
      await fetchAppSync({ query, variables });
      // チャット履歴リスト更新
      await getChatHistory();
    } catch (e) {
      console.error("delete chats error", e);
    }
  };

  /**
   * 指定されたチャットを表示する
   */
  const displayChat = async (chatid: string, updateHistory = true) => {
    try {
      if (!richChats[chatid]) {
        const query = `
        query($chatid:String!) {
          getChatDetail(chatid: $chatid) {
            chat {
              role content done dtm model
            }
          }
        }`;
        const variables = { chatid };
        const data = await fetchAppSync({ query, variables });
        const chatData = data?.getChatDetail?.chat ? data.getChatDetail.chat : [];

        updateChats((chats: Chats) => {
          chats[chatid] = chatData;
          return chats;
        });

        // frontChatも更新は updateChats 内で行われる
      } else {
        // 既存のチャットの場合も、updateChatsを使用して一貫性を保つ
        updateChats((chats: Chats) => chats);
      }

      setPagesChatId(chatid);
      if (updateHistory) router.push(`/?c=${chatid}`);
    } catch (e) {
      console.error("displayChat() error", e);
    }
  };

  return {
    getChatHistory,
    saveChat,
    deleteChats,
    displayChat,
    updateChats,
    setChatsEmptyMessages,
    fetchAppSync,
    newChat,
    setPagesChatId,
    pagesChatIdRef
  };
};
