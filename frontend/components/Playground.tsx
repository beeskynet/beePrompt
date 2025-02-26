"use client";
import React, { useState, useRef, useEffect, MutableRefObject } from "react";
import UserAssistant from "./UserAssistant";
import DropdownSelect from "./DropdownSelect";
import { Button, Input } from "@material-tailwind/react";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { useRouter, usePathname } from "next/navigation";
import { withAuthenticator } from "@aws-amplify/ui-react";
import { AppAtoms, Message, Chats } from "lib/store";
import { apiUrls } from "lib/environments";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import MaterialButton from "./MaterialButton";
import SettingsDrawer from "./SettingsDrawer";
import OpenAiSettingsDrawer from "./OpenAiSettingsDrawer";
import ClaudeSettingsDrawer from "./ClaudeSettingsDrawer";
import CohereSettingsDrawer from "./CohereSettingsDrawer";
import MenuDrawer from "./MenuDrawer";
import MobileDrawer from "./MobileDrawer";
import useOnWindowRefocus from "lib/useOnWindowReforcus";
import { useChat } from "../hooks/useChat";

interface WebSocketMap {
  [key: string]: WebSocket;
}

interface Dict<T> {
  [key: string]: T;
}

function PlayGround() {
  useOnWindowRefocus(async () => {
    const session = await fetchAuthSession();
    if (!session.tokens) {
      alert("セッションが終了しました。ログインしてください。");
      signOut();
    }
  });
  const [userInput, setUserInput] = useState("");
  const [frontChat, setFrontChat] = useAtom(AppAtoms.frontChat); // 画面表示用チャット内容
  const [richChats, setRichChats] = useAtom(AppAtoms.richChats); // 並列メッセージ受信によるメッセージ欠落を防ぐため、内部的にチャット内容を保持

  const setChats = (func: Function) => {
    const newRichChats = func(richChats);
    setRichChats(newRichChats);
    setFrontChat(JSON.parse(JSON.stringify(newRichChats[pagesChatIdRef.current] || [])));
  };

  const [messagesOnDeleteMode, setMessagesOnDeleteMode] = useAtom(AppAtoms.messagesOnDeleteMode);
  const [chatsOnDeleteMode, setChatsOnDeleteMode] = useState<Message[]>([]);
  const [chatidsForDelete, setChatsidsForDelete] = useState<string[]>([]);
  const [systemInput, setSystemInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [sidebarContent, setSidebarContent] = useState("history");
  const [sidebarDisplay, setSidebarDisplay] = useState(true);
  // 現在表示中のチャットIDを管理するref
  const pagesChatIdRef = useRef<string>("");
  const [_pagesChatIdState, setPagesChatIdState] = useAtom(AppAtoms.chatid);
  const setPagesChatId = (newChatid: string) => {
    pagesChatIdRef.current = newChatid;
    setPagesChatIdState(newChatid);
    // チャットIDが変更されたらfrontChatも更新
    if (richChats[newChatid]) {
      setFrontChat(JSON.parse(JSON.stringify(richChats[newChatid])));
    }
  };

  const [chatHistory, setChatHistory] = useAtom(AppAtoms.chatHistory);
  const [isAdmin, setIsAdmin] = useState(false);
  const selectedModel = useAtomValue(AppAtoms.selectedModel);
  const isParallel = useAtomValue(AppAtoms.isParallel);
  const submissionStatus = useAtomValue(AppAtoms.submissionStatus);
  const setWaitingMap = useSetAtom(AppAtoms.waitingMap);
  const isResponding = useAtomValue(AppAtoms.isResponding);
  const [isMessageDeleteMode, setIsMessageDeleteMode] = useAtom(AppAtoms.isMessageDeleteMode);
  const [isChatsDeleteMode, setIsChatsDeleteMode] = useAtom(AppAtoms.isChatsDeleteMode);
  const [chatidOnEditTitle, setChatidOnEditTitle] = useState("");
  const [chatHistoryLastEvaluatedKey, setChatHistoryLastEvaluatedKey] = useState("");
  const setOpenDrawer = useSetAtom(AppAtoms.drawerOpen);
  const router = useRouter();
  const pathname = usePathname();
  const [settings, setSettings] = useAtom(AppAtoms.settings);
  const [_, setWebsocketMap] = useState({});

  const userTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const systemTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaContRef = useRef(null);
  const autoScrollRef: { current: boolean | undefined } = useRef();
  autoScrollRef.current = autoScroll;
  const systemInputRef: { current: string | undefined } = useRef();

  const [temperatureGpt, setTemperatureGpt] = useState(1);
  const [topPGpt, setTopPGpt] = useState(1);
  const [frequencyPenaltyGpt, setFrequencyPenaltyGpt] = useState(0);
  const [presencePenaltyGpt, setPresencePenaltyGpt] = useState(0);
  const [temperatureClaude, setTemperatureClaude] = useState(1);
  const [temperatureCohere, setTemperatureCohere] = useState(0.3);
  //const [topPClaude, setTopPClaude] = useState(0.999);
  //const [topKClaude, setTopKClaude] = useState(250);
  const container = useRef<HTMLDivElement | null>(null);

  systemInputRef.current = systemInput;
  const setChatsEmptyMessages = (chatid: string) => {
    setChats((chats: Chats) => {
      chats[chatid] = [];
      return chats;
    });
  };
  const onMessage = async (event: MessageEvent) => {
    if (!event.data || event.data.startsWith('{"message": "Endpoint request timed out"')) return; // } // httpリクエスト正常終了応答=event.dataブランク
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
        interface Dict<T> {
          [key: string]: T;
        }
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

  const newChat = (e: React.MouseEvent | void) => {
    //e && e.target.blur();
    setIsMessageDeleteMode(false);
    const uuid = self.crypto.randomUUID();
    //history.pushState(null, null, `${url.origin}?c=${uuid}`);
    if (pathname === "/") {
      router.replace(`/?c=${uuid}`);
    } else {
      router.push(`/?c=${uuid}`);
    }
    setPagesChatId(uuid);
    setChatsEmptyMessages(uuid);
    if (!window.matchMedia("(min-width: 768px)").matches) {
      setSidebarDisplay(false);
    }
    return uuid;
  };

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

  const initSettings = async () => {
    try {
      const query = `
        query {
          getSettings
        }`;
      const data = await fetchAppSync({ query });
      const settings = JSON.parse(data.getSettings);
      if (settings) {
        // DBに存在しない項目はstore.jsでの初期化の内容を優先
        setSettings((orig) => ({
          modelSettings: { ...orig.modelSettings, ...settings.modelSettings },
          appSettings: { ...orig.appSettings, ...settings.appSettings },
          modelSelection: { ...orig.modelSelection, ...settings.modelSelection },
        }));
      }
    } catch (e) {
      console.error("getSettings() error", e);
    }
  };

  // useChat フックを初期化
  const { getChatHistory, saveChat, deleteChats, displayChat } = useChat({
    chatHistoryLastEvaluatedKey,
    setChatHistoryLastEvaluatedKey,
    fetchAppSync,
    setChats,
    chats: richChats,
    router,
    setChatid: setPagesChatId,
  });

  const onScroll = () => {
    const el = container.current;
    if (!el) return;
    const rate = el.scrollTop / (el.scrollHeight - el.clientHeight);
    if (rate > 0.99) {
      getChatHistory(true);
    }
  };

  useEffect(() => {
    const initUserid = async () => {
      const session = await fetchAuthSession();
      // 管理者判定
      setIsAdmin(session.tokens?.accessToken?.payload ? ["cognito:groups"].includes("admin") : false);

      // Chat情報初期化
      getChatHistory();
      const getUrlChatid = () => {
        const url = new URL(window.location.href);
        const prms = url.searchParams;
        return prms.get("c");
      };
      const gotChatId = getUrlChatid();
      if (!gotChatId) {
        newChat();
      } else {
        setPagesChatId(gotChatId);
        // pagesChatIdRefも明示的に初期化
        pagesChatIdRef.current = gotChatId;
        displayChat(gotChatId);
      }

      // DBからユーザー設定を取得
      initSettings();

      // 戻る・進む時の処理
      window.addEventListener("popstate", () => {
        const url = new URL(window.location.href);
        if (url.pathname !== "/" || !url.searchParams.has("c")) return;
        const gotChatId = getUrlChatid() + "";
        setPagesChatId(gotChatId);
        displayChat(gotChatId, false); // history.stateを更新しない
      });
    };
    initUserid();

    // スクロール操作でメッセージコンテナの下端から離れたらオートスクロールをオフに
    const atBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop === el.clientHeight;
    document.querySelector("#messages-container")?.addEventListener("scroll", (e) => {
      if (atBottom(e.target as HTMLElement)) {
        setAutoScroll(true);
      } else {
        setAutoScroll(false);
      }
    });
  }, []);

  // useEffect() [userInput]
  useEffect(() => {
    // テキストエリアの高さを自動調整する
    const autoHight = (ref: MutableRefObject<HTMLTextAreaElement | null>) => {
      const textarea = ref.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight + 5}px`;
    };
    autoHight(userTextareaRef);
    autoHight(systemTextareaRef);

    setTimeout(() => {
      const messagesContainer = document.querySelector("#messages-container");
      messagesContainer?.scrollTo(0, messagesContainer.scrollHeight);
    }, 0);
  }, [userInput, systemInput]);
  const scrollToBottom = () => {
    if (!autoScrollRef.current) return;
    setTimeout(() => {
      const messagesContainer = document.querySelector("#messages-container");
      messagesContainer?.scrollTo(0, messagesContainer.scrollHeight);
    }, 0);
  };
  const handleUserSubmit = async () => {
    if (!userInput) return;
    setUserInput(""); // 2重処理抑止のために最初に
    if (isParallel && Object.values(submissionStatus).filter((status) => status).length === 0) {
      alert("AIモデルを選択してください。");
      return;
    }
    // チャット履歴欄に追加
    setChatHistory((chatHistory: Message[]) => {
      if (chatHistory.filter((chat: Message) => chat.chatid === pagesChatIdRef.current).length > 0) {
        return chatHistory;
      }
      return [{ chatid: pagesChatIdRef.current, title: "...waiting AI response..." }, ...chatHistory];
    });
    // ユーザーメッセージ追加
    const userDtm = new Date().toISOString();
    setChats((chats: Chats) => {
      const messages = chats[pagesChatIdRef.current];
      chats[pagesChatIdRef.current] = [...messages, { role: "user", content: userInput, dtm: userDtm }];
      return chats;
    });
    // サブミット
    const submit = async (model: string, userDtm: string) => {
      try {
        const dtm = new Date().toISOString();
        setChats((chats: Chats) => {
          const messages = chats[pagesChatIdRef.current];
          chats[pagesChatIdRef.current] = [...messages, { role: "assistant", model: model, content: null, dtm }];
          return chats;
        });
        scrollToBottom();

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
          temperatureGpt: temperatureGpt,
          topPGpt: topPGpt,
          frequencyPenaltyGpt: frequencyPenaltyGpt,
          presencePenaltyGpt: presencePenaltyGpt,
          temperatureClaude: temperatureClaude,
          temperatureCohere: temperatureCohere,
          // topPClaude: topPClaude,
          // topKClaude: topKClaude,
          messages: richChats[pagesChatIdRef.current].map((msg: Message) => ({
            role: msg.role,
            dtm: msg.dtm,
            model: msg.model,
            content: msg.content,
            done: msg.done,
          })),
          model: model,
          chatid: pagesChatIdRef.current,
          dtm,
          userDtm,
          jwt,
        });
        const websocket = new WebSocket(apiUrls.wss);
        setWebsocketMap((map: WebSocketMap) => {
          map[dtm] = websocket;
          return map;
        });
        websocket.onmessage = onMessage;
        websocket.onopen = () => websocket.send(prm);
      } catch (error: unknown) {
        // Consider implementing your own error handling logic here
        console.error("submit error", error);
        if (error instanceof Error) alert(error.message);
      }
    };
    if (!isParallel) {
      submit(selectedModel, userDtm);
    } else {
      for (const [i, model] of Object.entries(Object.keys(submissionStatus))) {
        //console.info(model, submissionStatus[model]);
        if (submissionStatus[model]) {
          setTimeout(() => submit(model, userDtm), parseInt(i) * 100);
        }
      }
    }
  };
  const clickChatHistoryLine = (chatid: string) => async () => {
    setIsMessageDeleteMode(false);
    displayChat(chatid);
    if (!window.matchMedia("(min-width: 768px)").matches) {
      setSidebarDisplay(false);
    }
  };

  const toggleSidebar = () => {
    const content = sidebarContent === "history" ? "edit" : "history";
    setSidebarContent(content);
  };
  const toggleDisplaySidebar = () => {
    setSidebarDisplay(!sidebarDisplay);
  };
  const ChatTitleEdit = ({ chat }: { chat: Message }) => {
    const { chatid } = chat;
    const origTitle = chat.title + "";
    const [title, setTitle] = useState(origTitle);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
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

  const msgsOnDisplay = !isMessageDeleteMode ? frontChat : messagesOnDeleteMode;
  const chatsOnDisplay = !isChatsDeleteMode ? chatHistory : chatsOnDeleteMode;
  return (
    <div id="screen-outline" className="flex flex-col md:h-screen p-2">
      {/* ヘッダーエリア */}
      <div className="fixed top-0 left-0 right-0 bg-white z-50 p-1 flex justify-between items-center md:relative">
        {window.matchMedia("(min-width: 768px)").matches ? (
          <img src="/beePrompt_ganache_432x96.png" style={{ width: 144, height: 32 }} />
        ) : (
          <MaterialButton name="menu" size={32} onClick={() => setOpenDrawer("drawerMobile")} />
        )}
        <div className="flex flex-row">
          {window.matchMedia("(min-width: 768px)").matches ? (
            <Button
              onClick={newChat}
              className="focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500 whitespace-nowrap py-1 px-2 border border-gray-500 bg-gray-400 font-normal text-white rounded w-36 shadow-none hover:shadow-none"
            >
              New Chat
            </Button>
          ) : null}
          <DropdownSelect />
        </div>
        <MaterialButton name="person" size={32} onClick={() => setOpenDrawer("drawerZero")} />
        <SettingsDrawer />
        <OpenAiSettingsDrawer
          temperatureGpt={temperatureGpt}
          setTemperatureGpt={setTemperatureGpt}
          topPGpt={topPGpt}
          setTopPGpt={setTopPGpt}
          frequencyPenaltyGpt={frequencyPenaltyGpt}
          setFrequencyPenaltyGpt={setFrequencyPenaltyGpt}
          presencePenaltyGpt={presencePenaltyGpt}
          setPresencePenaltyGpt={setPresencePenaltyGpt}
        />
        <ClaudeSettingsDrawer temperatureClaude={temperatureClaude} setTemperatureClaude={setTemperatureClaude} />
        <CohereSettingsDrawer temperatureCohere={temperatureCohere} setTemperatureCohere={setTemperatureCohere} />
        <MenuDrawer />
        <MobileDrawer toggleHistory={toggleDisplaySidebar} newChat={newChat} />
      </div>

      {/* メインエリア */}
      <div id="main-container" className="flex flex-col md:flex-row overflow-y-auto mt-14 md:mt-0">
        {/* サイドバー */}
        <div id="sidebar-container" className="md:w-1/4 border rounded-md relative">
          {/* チャット履歴/システムメッセージ切り替えボタン
          <button onClick={() => toggleSidebar()} className="absolute top-1 right-1 bg-transparent border-0 text-gray-500">
            {sidebarContent === "history" ? "編" : "履"}
          </button>
           */}

          {/* システムメッセージエリア */}
          <div id="system-input-area" className={`${sidebarContent !== "edit" ? "hidden" : ""}`}>
            <label htmlFor="system-input" className="text-sm m-2 text-left text-gray-500">
              SYSTEM
            </label>
            <textarea
              id="system-input"
              ref={systemTextareaRef}
              className="w-full p-2 pt-0 resize-none bg-transparent focus:outline-none"
              value={systemInput}
              onChange={(e) => setSystemInput(e.target.value)}
              placeholder="SYSTEM input..."
            />
          </div>
          {/* 履歴エリア */}
          <div id="history-area" className={`h-full flex flex-col ${!sidebarDisplay || sidebarContent !== "history" ? "hidden" : ""} relative`}>
            <p className="text-sm text-left m-2 mt-1 text-gray-500">HISTORY</p>
            {!isChatsDeleteMode ? (
              <MaterialButton
                name="delete"
                className="absolute top-0 right-0"
                onClick={() => {
                  setIsChatsDeleteMode(true);
                  setChatsOnDeleteMode(chatHistory.map((chat: Message) => JSON.parse(JSON.stringify(chat))));
                  setChatsidsForDelete([]);
                }}
              />
            ) : (
              <>
                <MaterialButton
                  name="done"
                  className="absolute top-0 right-7"
                  onClick={async () => {
                    if (chatidsForDelete.length === 0) {
                      setIsChatsDeleteMode(false);
                      return;
                    }
                    setChatsidsForDelete([]); // 2重処理抑止のため最初に
                    await deleteChats(chatidsForDelete);
                    await getChatHistory();
                    setIsChatsDeleteMode(false); // 履歴を消した後に表示切り替え
                    setChatsOnDeleteMode([]);
                    if (chatidsForDelete.includes(pagesChatIdRef.current)) {
                      setChatsEmptyMessages(pagesChatIdRef.current);
                    }
                  }}
                />
                <MaterialButton
                  name="cancel"
                  className="absolute top-0 right-0"
                  onClick={() => {
                    setIsChatsDeleteMode(false);
                    setChatsOnDeleteMode([]);
                    setChatsidsForDelete([]);
                  }}
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
                      onClick={() => {
                        setChatsOnDeleteMode((chats) => chats.filter((_chat: Message) => _chat.chatid !== chat.chatid));
                        setChatsidsForDelete(chatidsForDelete.concat([chat.chatid + ""]));
                      }}
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
        </div>
        {/* USER・ASSISTANTメッセージエリア */}
        <div id="main-area" className="flex md:w-3/4">
          <div id="messages-container" className="frex flex-col flex-grow overflow-y-auto">
            {msgsOnDisplay ? msgsOnDisplay.map((message: Message, index: number) => <UserAssistant message={message} key={index} />) : null}
            <div className="ml-2 flex flex-row" ref={textareaContRef}>
              <textarea
                ref={userTextareaRef}
                className="flex p-2 w-full max-h-96 border border-indigo-100 rounded-md resize-none focus:outline-none"
                value={userInput}
                disabled={isMessageDeleteMode}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="USER input..."
              />
              <div className="p-5 pr-2 mt-auto">
                <Button
                  onClick={handleUserSubmit}
                  disabled={isMessageDeleteMode || (!isAdmin && isResponding)}
                  className="py-1 px-2 bg-blue-400 border border-blue-600 shadow-none font-normal text-white rounded h-10 hover:shadow-none"
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
          <div id="tool-bar" className="flex flex-col align-start w-10 flex-shrink-0">
            {isResponding ? (
              <MaterialButton
                name="block"
                onClick={async () => {
                  // 全websocket接続を切断
                  setWebsocketMap((websocketMap: WebSocketMap) => {
                    Object.keys(websocketMap).map((dtm) => {
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
                }}
              />
            ) : null}
            {!isMessageDeleteMode ? (
              <>
                <MaterialButton
                  name="delete"
                  disabled={isResponding}
                  onClick={async () => {
                    if (richChats[pagesChatIdRef.current].length === 0) return;
                    if (settings.appSettings.copyChatOnMessageDeleteMode) {
                      // チャットメッージを削除モードに入る際にメッセージをコピーする
                      const newTitle = "copy_" + chatHistory.filter((chat: Message) => chat.chatid === pagesChatIdRef.current)[0].title;
                      const uuid = self.crypto.randomUUID();
                      await saveChat(uuid, richChats[pagesChatIdRef.current], systemInput, newTitle);
                    }
                    setMessagesOnDeleteMode(JSON.parse(JSON.stringify(richChats[pagesChatIdRef.current])));
                    setIsMessageDeleteMode(true);
                  }}
                />
                <MaterialButton name="settings_applications" onClick={() => setOpenDrawer("AppSettingDrawer")} />
                <div className="flex justify-end cursor-pointer">
                  <span onClick={() => setOpenDrawer("OpenAISettingDrawer")} style={{ padding: 6 }}>
                    <img src="../openai-logomark.svg" width="20" height="20" />
                  </span>
                </div>
                <div className="flex justify-end cursor-pointer">
                  <span onClick={() => setOpenDrawer("ClaudeSettingDrawer")} style={{ padding: 0 }}>
                    <img src="../anthropic.ico" width="30" height="30" />
                  </span>
                </div>
                <div className="flex justify-end cursor-pointer">
                  <span onClick={() => setOpenDrawer("CohereSettingDrawer")} style={{ padding: 5 }}>
                    <img src="../cohere-logo.svg" width="20" height="20" />
                  </span>
                </div>
              </>
            ) : (
              <>
                <MaterialButton
                  name="done"
                  onClick={async () => {
                    setChats((chats: Chats) => {
                      chats[pagesChatIdRef.current] = messagesOnDeleteMode;
                      return chats;
                    });
                    setIsMessageDeleteMode(false);
                    await saveChat(pagesChatIdRef.current, messagesOnDeleteMode, systemInput);
                  }}
                />
                <MaterialButton
                  name="cancel"
                  onClick={() => {
                    setMessagesOnDeleteMode([]);
                    setIsMessageDeleteMode(false);
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuthenticator(PlayGround);
