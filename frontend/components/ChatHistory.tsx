"use client";
import React, { useRef, useState, MutableRefObject } from "react";
import { Input } from "@material-tailwind/react";
import { Message, Chats, AppAtoms } from "lib/store";
import MaterialButton from "./MaterialButton";
import { useAtom } from "jotai";

interface ChatHistoryProps {
  pagesChatIdRef: React.MutableRefObject<string>;
  container: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  sidebarDisplay: boolean;
  sidebarContent: string;
  clickChatHistoryLine: (chatid: string) => () => Promise<void>;
  deleteChats: (chatids: string[]) => Promise<void>;
  getChatHistory: () => Promise<void>;
  setChatsEmptyMessages: (chatid: string) => void;
  saveChat: (chatid: string, messages: Message[], sysMsg: string | undefined, title?: string) => Promise<void>;
  systemInput: string;
}

/**
 * チャット履歴を表示・管理するコンポーネント
 */
const ChatHistory: React.FC<ChatHistoryProps> = ({
  pagesChatIdRef,
  container,
  onScroll,
  sidebarDisplay,
  sidebarContent,
  clickChatHistoryLine,
  deleteChats,
  getChatHistory,
  setChatsEmptyMessages,
  saveChat,
  systemInput,
}) => {
  // Jotaiアトムから直接ステートを取得
  const [isChatsDeleteMode, setIsChatsDeleteMode] = useAtom(AppAtoms.isChatsDeleteMode);
  const [chatHistory] = useAtom(AppAtoms.chatHistory);
  const [richChats] = useAtom(AppAtoms.richChats);
  
  // 内部ステートとして管理
  const [chatidOnEditTitle, setChatidOnEditTitle] = useState("");
  const [chatsOnDeleteMode, setChatsOnDeleteMode] = useState<Message[]>([]);
  const [chatidsForDelete, setChatidsForDelete] = useState<string[]>([]);

  // チャットタイトル編集用コンポーネント
  const ChatTitleEdit = ({ chat }: { chat: Message }) => {
    const { chatid } = chat;
    const origTitle = chat.title + "";
    const [title, setTitle] = useState(origTitle);
    const inputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(origTitle.length, origTitle.length);
    }, []);

    const onChange = ({ target }: { target: HTMLInputElement }) => setTitle(target.value);
    const reset = () => {
      setChatidOnEditTitle("");
    };
    return (
      <Input
        className="!border !border-gray-300 bg-white text-gray-900 shadow-lg shadow-gray-900/5 ring-4 ring-transparent placeholder:text-gray-500 focus:!border-gray-900 focus:!border-t-gray-900 focus:ring-gray-900/10"
        labelProps={{
          className: "hidden",
        }}
        inputRef={inputRef}
        value={title}
        onChange={onChange}
        onKeyDown={async (e) => {
          if (e.key === "Escape") {
            reset();
          }
          if (e.key === "Enter") {
            await saveChat(chatid + "", richChats[chatid + ""], systemInput, title);
            reset();
          }
        }}
        onBlur={reset}
      />
    );
  };

  // 削除モードを開始する
  const handleStartDeleteMode = () => {
    setIsChatsDeleteMode(true);
    setChatsOnDeleteMode(chatHistory.map((chat: Message) => JSON.parse(JSON.stringify(chat))));
    setChatidsForDelete([]);
  };

  // 削除を確定する
  const handleConfirmDelete = async () => {
    if (chatidsForDelete.length === 0) {
      setIsChatsDeleteMode(false);
      return;
    }
    setChatidsForDelete([]); // 2重処理抑止のため最初に
    await deleteChats(chatidsForDelete);
    await getChatHistory();
    setIsChatsDeleteMode(false); // 履歴を消した後に表示切り替え
    setChatsOnDeleteMode([]);
    if (chatidsForDelete.includes(pagesChatIdRef.current)) {
      setChatsEmptyMessages(pagesChatIdRef.current);
    }
  };

  // 削除をキャンセルする
  const handleCancelDelete = () => {
    setIsChatsDeleteMode(false);
    setChatsOnDeleteMode([]);
    setChatidsForDelete([]);
  };

  // チャットを削除対象に追加する
  const handleAddToDeleteList = (chat: Message) => {
    setChatsOnDeleteMode((chats) => chats.filter((_chat: Message) => _chat.chatid !== chat.chatid));
    setChatidsForDelete(chatidsForDelete.concat([chat.chatid + ""]));
  };

  // 表示するチャット履歴
  const chatsOnDisplay = !isChatsDeleteMode ? chatHistory : chatsOnDeleteMode;

  return (
    <div id="history-area" className={`h-full flex flex-col ${!sidebarDisplay || sidebarContent !== "history" ? "hidden" : ""} relative`}>
      <p className="text-sm text-left m-2 mt-1 text-gray-500">HISTORY</p>
      {!isChatsDeleteMode ? (
        <MaterialButton
          name="delete"
          className="absolute top-0 right-0"
          onClick={handleStartDeleteMode}
        />
      ) : (
        <>
          <MaterialButton
            name="done"
            className="absolute top-0 right-7"
            onClick={handleConfirmDelete}
          />
          <MaterialButton
            name="cancel"
            className="absolute top-0 right-0"
            onClick={handleCancelDelete}
          />
        </>
      )}
      <div className="overflow-x-hidden overflow-y-auto" ref={container} onScroll={onScroll}>
        {chatsOnDisplay.map((chat: Message, index: number) => (
          <div key={index} className="relative group">
            {isChatsDeleteMode ? (
              <MaterialButton
                name="delete"
                className="absolute top-0 right-0 "
                onClick={() => handleAddToDeleteList(chat)}
                blur
              />
            ) : null}
            {!isChatsDeleteMode && pagesChatIdRef.current === chat.chatid ? (
              <MaterialButton
                name="edit"
                className="absolute top-0 right-0 invisible"
                groupHoverVisible
                onClick={() => {
                  setChatidOnEditTitle(chat.chatid + "");
                }}
                blur
              />
            ) : null}
            {chatidOnEditTitle !== chat.chatid ? (
              <div
                key={index}
                className={`pl-3 p-1 cursor-pointer whitespace-nowrap ${
                  chat.chatid === pagesChatIdRef.current ? "bg-gray-200" : "hover:bg-gray-100"
                }`}
                onClick={clickChatHistoryLine(chat.chatid + "")}
              >
                <span className="text-sm">{chat.title}</span>
              </div>
            ) : (
              <ChatTitleEdit chat={chat} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatHistory; 