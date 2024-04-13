"use client";
import React, { useState, useRef, useEffect } from "react";
import UserAssistant from "./UserAssistant";
import DropdownSelect from "./DropdownSelect";
import { Button, Menu, MenuHandler, MenuList, MenuItem, Input } from "@material-tailwind/react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { withAuthenticator } from "@aws-amplify/ui-react";
import { AppAtoms } from "lib/store";
import { apiUrls } from "lib/environments";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import MaterialButton from "./MaterialButton";
import SettingsDrawer from "./SettingsDrawer";
import OpenAiSettingsDrawer from "./OpenAiSettingsDrawer";
import ClaudeSettingsDrawer from "./ClaudeSettingsDrawer";
import MenuDrawer from "./MenuDrawer";
import useOnWindowRefocus from "lib/useOnWindowReforcus";

let chats: any = {};
let chatid = "";
function PlayGround({ signOut }: any) {
  useOnWindowRefocus(async () => {
    const session = await fetchAuthSession();
    if (!session.tokens) {
      alert("セッションが終了しました。ログインしてください。");
      signOut();
    }
  });
  const [userInput, setUserInput] = useState("");
  const [_chats, _setChats] = useAtom(AppAtoms.chats);
  const setChats = (func: any) => {
    chats = func(chats);
    _setChats(JSON.parse(JSON.stringify(chats)));
    _chats; // 表示更新用
  };
  const [messagesOnDeleteMode, setMessagesOnDeleteMode]: any = useAtom(AppAtoms.messagesOnDeleteMode);
  const [chatsOnDeleteMode, setChatsOnDeleteMode]: any = useState([]);
  const [chatidsForDelete, setChatsidsForDelete]: any = useState([]);
  const [systemInput, setSystemInput]: any = useState("");
  const [autoScroll, setAutoScroll]: any = useState(true);
  const [sidebarContent, setSidebarContent]: any = useState("history");
  const [_chatid, _setChatid]: any = useAtom(AppAtoms.chatid);
  const setChatid = (newChatid: any) => {
    chatid = newChatid;
    _setChatid(newChatid);
  };
  const [chatHistory, setChatHistory]: any = useAtom(AppAtoms.chatHistory);
  const [userid, setUserid]: any = useState("");
  const [isAdmin, setIsAdmin]: any = useState(false);
  const selectedModel: any = useAtomValue(AppAtoms.selectedModel);
  const isParallel: any = useAtomValue(AppAtoms.isParallel);
  const submissionStatus: any = useAtomValue(AppAtoms.submissionStatus);
  const setWaitingMap: any = useSetAtom(AppAtoms.waitingMap);
  const isResponding: any = useAtomValue(AppAtoms.isResponding);
  const [isMessageDeleteMode, setIsMessageDeleteMode]: any = useAtom(AppAtoms.isMessageDeleteMode);
  const [isChatsDeleteMode, setIsChatsDeleteMode]: any = useAtom(AppAtoms.isChatsDeleteMode);
  const [chatidOnEditTitle, setChatidOnEditTitle]: any = useState("");
  const setOpenDrawer: any = useSetAtom(AppAtoms.drawerOpen);
  const router: any = useRouter();
  const [settings, setSettings]: any = useAtom(AppAtoms.settings);
  const [_, setWebsocketMap]: any = useState({});
  const [chatHistoryLastEvaluatedKey, setChatHistoryLastEvaluatedKey] = useState("");

  const userTextareaRef: any = useRef();
  const systemTextareaRef: any = useRef();
  const textareaContRef: any = useRef();
  const autoScrollRef: any = useRef();
  autoScrollRef.current = autoScroll;
  const chatidRef: any = useRef();
  chatidRef.current = chatid;
  const systemInputRef: any = useRef();

  const [temperatureGpt, setTemperatureGpt] = useState(1);
  const [topPGpt, setTopPGpt] = useState(1);
  const [frequencyPenaltyGpt, setFrequencyPenaltyGpt] = useState(0);
  const [presencePenaltyGpt, setPresencePenaltyGpt] = useState(0);
  const [temperatureClaude, setTemperatureClaude] = useState(1);
  //const [topPClaude, setTopPClaude] = useState(0.999);
  //const [topKClaude, setTopKClaude] = useState(250);
  const container = useRef<HTMLDivElement | null>(null);

  systemInputRef.current = systemInput;
  const setChatsEmptyMessages = (chatid: any) => {
    setChats((chats: any) => {
      chats[chatid] = [];
      return chats;
    });
  };

  const onMessage = async (event: any) => {
    if (!event.data || event.data.startsWith('{"message": "Endpoint request timed out"')) return; // } // httpリクエスト正常終了応答=event.dataブランク
    const cleanupWebSocket: any = (dtm: any) => {
      // 接続のクリーンナップ
      event.target.close();
      setWebsocketMap((websocketMap: any) => {
        if (dtm && dtm in websocketMap) {
          delete websocketMap[dtm];
        }
        return websocketMap;
      });
    };

    try {
      const { content, dtm, chatid, userDtm, done, error, errorType, errorMessage } = JSON.parse(event.data);
      if (dtm === undefined) {
        console.error("想定外のレスポンス形式", event.data);
      } else if (content !== undefined) {
        // メッセージ追記
        setChats((chats: any) => {
          const messages = chats[chatid];
          const tgtAssMsg = messages.filter((msg: any) => msg.role === "assistant" && dtm === msg.dtm);
          if (!tgtAssMsg.length) return chats;
          const origContent = tgtAssMsg[0].content;
          const updatedMsgs = messages.map((msg: any) =>
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
        setWaitingMap((waitingMap: any) => ({ ...waitingMap, [dtm]: 0 }));
        cleanupWebSocket(dtm);
        console.info(event.data); // 利用料等情報
        setChats((chats: any) => {
          const messages = chats[chatid];
          const updatedMsgs = messages.map((msg: any) => (![dtm, userDtm].includes(msg.dtm) ? msg : { ...msg, done }));
          chats[chatid] = updatedMsgs;
          return chats;
        });
        await saveChat(chatid, chats[chatid], systemInputRef.current);
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
        setWaitingMap((waitingMap: any) => ({ ...waitingMap, [dtm]: 0 }));
        cleanupWebSocket(dtm);
        let chatErrorMessage: string;
        if (Object.keys(errorMessages).includes(errorType)) {
          chatErrorMessage = errorMessages[errorType];
        } else {
          console.error("想定外のレスポンス形式", event.data);
          chatErrorMessage = "An error happend.";
        }
        setChats((chats: any) => {
          const messages = chats[chatid];
          const updatedMsgs = messages.map((msg: any) =>
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

  const deleteChats = async (chatids: any) => {
    try {
      // チャット削除
      const query = `
        mutation($chatids:[String]!, $userid:String!) {
          deleteChats(chatids: $chatids, userid: $userid)
        }`;
      const variables = { userid, chatids };
      await fetchAppSync({ query, variables });
      // チャット履歴リスト更新
      await getChatHistory(userid);
    } catch (e) {
      console.error("delete chats error", e);
    }
  };

  const saveChat = async (chatid: any, messages: any, sysMsg: any, title = null) => {
    if (!messages || messages.length === 0) return;
    try {
      // チャット保存
      const query = `
            mutation($chatid:String!, $userid:String!, $messages:[MessageInput]!, $title:String, $sysMsg:String) {
              putChat(chatid: $chatid, userid: $userid, sysMsg: $sysMsg, title: $title, messages: $messages)
            }`;
      const variables = { userid, chatid, messages: messages.filter((msg: any) => !msg.isError), sysMsg, title };
      await fetchAppSync({ query, variables });
      // チャット履歴リスト更新
      await getChatHistory(userid);
    } catch (e) {
      console.error("save chat error", e);
    }
  };

  const newChat: any = (e: any) => {
    e && e.target.blur();
    setIsMessageDeleteMode(false);
    const uuid = self.crypto.randomUUID();
    //history.pushState(null, null, `${url.origin}?c=${uuid}`);
    if (router.pathname === "/") {
      router.replace(`/?c=${uuid}`);
    } else {
      router.push(`/?c=${uuid}`);
    }
    setChatid(uuid);
    setChatsEmptyMessages(uuid);
    return uuid;
  };

  const fetchAppSync = async ({ query, variables }: any) => {
    const session: any = await fetchAuthSession();
    const res = await fetch(apiUrls.appSync, {
      method: "POST",
      headers: { Authorization: session.tokens.accessToken.toString() },
      body: JSON.stringify({ query, variables }),
    });
    const resJson = await res.json();
    if (resJson.errors) {
      console.error(resJson.errors[0].message, resJson.errors);
      throw "AppSync error.";
    }
    return resJson?.data;
  };

  const initSettings = async (userid: any) => {
    try {
      const query = `
        query($userid:String!) {
          getSettings(userid: $userid)
        }`;
      const variables = { userid };
      const data = await fetchAppSync({ query, variables });
      const settings = JSON.parse(data.getSettings);
      if (settings) {
        // DBに存在しない項目はstore.jsでの初期化の内容を優先
        setSettings((orig: any) => ({
          modelSettings: { ...orig.modelSettings, ...settings.modelSettings },
          appSettings: { ...orig.appSettings, ...settings.appSettings },
        }));
      }
    } catch (e) {
      console.error("getSettings() error", e);
    }
  };
  const displayChat = async (userid: any, chatid: any, updateHistory = true) => {
    try {
      if (!chats[chatid]) {
        const query = `
        query($chatid:String!, $userid:String!) {
          getChatDetail(chatid: $chatid, userid: $userid) {
            chat {
              role content done dtm model
            }
          }
        }`;
        const variables = { userid, chatid };
        const data = await fetchAppSync({ query, variables });
        setChats((chats: any) => {
          chats[chatid] = data?.getChatDetail?.chat ? data.getChatDetail.chat : [];
          return chats;
        });
      }
      setChatid(chatid);
      //if (updateHistory) history.pushState(null, null, `${new URL(window.location.href).origin}?c=${chatid}`);
      if (updateHistory) router.push(`/?c=${chatid}`);
    } catch (e) {
      console.error("displayChat() error", e);
    }
  };

  const getChatHistory = async (userid: string, isOnScroll: boolean = false) => {
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
      setChatHistory((chatHistory: any) => {
        if (isOnScroll) {
          return [...chatHistory, ...chats];
        } else {
          // 応答中チャットとDBから取得したチャット履歴をマージ
          const gotChatids = chats.map((chat: any) => chat.chatid);
          const responding = chatHistory.filter((chat: any) => chat.title === "...waiting AI response..." && !gotChatids.includes(chat.chatid));
          return chats ? [...responding, ...chats] : [...responding];
        }
      });
    } catch (e) {
      console.error("getChatHistory()", e);
    }
  };
  const onScroll = () => {
    const el = container.current;
    if (!el) return;
    const rate = el.scrollTop / (el.scrollHeight - el.clientHeight);
    if (rate > 0.99) {
      getChatHistory(userid, true);
    }
  };

  useEffect(() => {
    const initUserid = async () => {
      const session: any = await fetchAuthSession();

      // ユーザー情報取得
      const userid = session.tokens.accessToken.payload.sub;
      setUserid(userid);

      // 管理者判定
      setIsAdmin(session.tokens.accessToken.payload["cognito:groups"].includes("admin"));

      // Chat情報初期化
      getChatHistory(userid);
      const getUrlChatid = () => {
        const url = new URL(window.location.href);
        const prms = url.searchParams;
        return prms.get("c");
      };
      const gotChatId = getUrlChatid();
      if (!gotChatId) {
        newChat();
      } else {
        setChatid(gotChatId);
        displayChat(userid, gotChatId);
      }

      // DBからユーザー設定を取得
      initSettings(userid);

      // 戻る・進む時の処理
      window.addEventListener("popstate", () => {
        const url = new URL(window.location.href);
        if (url.pathname !== "/" || !url.searchParams.has("c")) return;
        const gotChatId = getUrlChatid();
        setChatid(gotChatId);
        displayChat(userid, gotChatId, false); // history.stateを更新しない
      });
    };
    initUserid();

    // スクロール操作でメッセージコンテナの下端から離れたらオートスクロールをオフに
    const atBottom = (el: any) => el.scrollHeight - el.scrollTop === el.clientHeight;
    document.querySelector("#messages-container")?.addEventListener("scroll", (e) => {
      if (atBottom(e.target)) {
        setAutoScroll(true);
      } else {
        setAutoScroll(false);
      }
    });
  }, []);

  // useEffect() [userInput]
  useEffect(() => {
    // テキストエリアの高さを自動調整する
    const autoHight = (ref: any) => {
      const textarea = ref.current;
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
    setChatHistory((chatHistory: any) => {
      if (chatHistory.filter((chat: any) => chat.chatid === chatid).length > 0) {
        return chatHistory;
      }
      return [{ chatid, title: "...waiting AI response..." }, ...chatHistory];
    });
    // ユーザーメッセージ追加
    const userDtm = new Date().toISOString();
    setChats((chats: any) => {
      const messages = chats[chatid];
      chats[chatid] = [...messages, { role: "user", content: userInput, dtm: userDtm }];
      return chats;
    });
    // サブミット
    const submit = async (model: any, userDtm: any) => {
      try {
        const dtm = new Date().toISOString();
        setChats((chats: any) => {
          const messages = chats[chatid];
          chats[chatid] = [...messages, { role: "assistant", model: model, content: null, dtm }];
          return chats;
        });
        scrollToBottom();

        // メッセージ送信
        const session: any = await fetchAuthSession();
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
          // topPClaude: topPClaude,
          // topKClaude: topKClaude,
          messages: chats[chatid].map((msg: any) => ({ role: msg.role, dtm: msg.dtm, model: msg.model, content: msg.content, done: msg.done })),
          model: model,
          chatid,
          dtm,
          userDtm,
          jwt,
        });
        const websocket = new WebSocket(apiUrls.wss);
        setWebsocketMap((map: any) => {
          map[dtm] = websocket;
          return map;
        });
        websocket.onmessage = onMessage;
        websocket.onopen = () => websocket.send(prm);
      } catch (error: any) {
        // Consider implementing your own error handling logic here
        console.error("submit error", error);
        alert(error.message);
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
  const clickChatHistoryLine = (chatid: any) => async () => {
    setIsMessageDeleteMode(false);
    displayChat(userid, chatid);
  };
  const toggleSidebar = () => {
    const content = sidebarContent === "history" ? "edit" : "history";
    setSidebarContent(content);
  };
  const ChatTitleEdit = ({ chat }: any) => {
    const { chatid } = chat;
    const origTitle = chat.title;
    const [title, setTitle] = useState(origTitle);
    const inputRef: any = useRef();

    useEffect(() => {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(origTitle.length, origTitle.length);
    }, []);

    const onChange = ({ target }: any) => setTitle(target.value);
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
            await saveChat(chatid, chats[chatid], systemInput, title);
            reset();
          }
        }}
        onBlur={reset}
      />
    );
  };

  const msgsOnDisplay = !isMessageDeleteMode ? chats[chatid] : messagesOnDeleteMode;
  const chatsOnDisplay = !isChatsDeleteMode ? chatHistory : chatsOnDeleteMode;
  return (
    <div id="screen-outline" className="flex flex-col h-screen p-2">
      {/* ヘッダーエリア */}
      <div className="p-1 flex justify-between items-center">
        <img src="/beePrompt_ganache_432x96.png" style={{ width: 144, height: 32 }} />
        <div className="flex flex-row">
          <Button
            onClick={newChat}
            className="focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500 whitespace-nowrap py-1 px-2 border border-gray-500 bg-gray-400 font-normal text-white rounded w-36 shadow-none hover:shadow-none"
          >
            New Chat
          </Button>
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
        <MenuDrawer signOut={signOut} />
      </div>

      {/* メインエリア */}
      <div id="main-container" className="flex overflow-y-auto">
        {/* サイドバー */}
        <div id="sidebar-container" className="w-1/4 border rounded-md relative">
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
          <div id="history-area" className={`h-full flex flex-col ${sidebarContent !== "history" ? "hidden" : ""} relative`}>
            <p className="text-sm text-left m-2 mt-1 text-gray-500">HISTORY</p>
            {!isChatsDeleteMode ? (
              <MaterialButton
                name="delete"
                className="absolute top-0 right-0"
                onClick={() => {
                  setIsChatsDeleteMode(true);
                  setChatsOnDeleteMode(chatHistory.map((chat: any) => JSON.parse(JSON.stringify(chat))));
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
                    await getChatHistory(userid);
                    setIsChatsDeleteMode(false); // 履歴を消した後に表示切り替え
                    setChatsOnDeleteMode([]);
                    if (chatidsForDelete.includes(chatid)) {
                      setChatsEmptyMessages(chatid);
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
              {chatsOnDisplay.map((chat: any, index: any) => (
                <div key={index} className="relative group">
                  {isChatsDeleteMode ? (
                    <MaterialButton
                      name="delete"
                      className="absolute top-0 right-0 "
                      onClick={() => {
                        setChatsOnDeleteMode((chats: any) => chats.filter((_chat: any) => _chat.chatid !== chat.chatid));
                        setChatsidsForDelete(chatidsForDelete.concat([chat.chatid]));
                      }}
                      blur
                    />
                  ) : null}
                  {!isChatsDeleteMode && chatid === chat.chatid ? (
                    <MaterialButton
                      name="edit"
                      className="absolute top-0 right-0 invisible"
                      groupHoverVisible
                      onClick={() => {
                        setChatidOnEditTitle(chat.chatid);
                      }}
                      blur
                    />
                  ) : null}
                  {chatidOnEditTitle !== chat.chatid ? (
                    <div
                      key={index}
                      className={`pl-3 p-1 cursor-pointer whitespace-nowrap ${chat.chatid === chatid ? "bg-gray-200" : "hover:bg-gray-100"}`}
                      onClick={clickChatHistoryLine(chat.chatid)}
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
        <div id="main-area" className="flex w-3/4">
          <div id="messages-container" className="frex flex-col flex-grow overflow-y-auto">
            {msgsOnDisplay ? msgsOnDisplay.map((message: any, index: any) => <UserAssistant message={message} key={index} />) : null}
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
                  setWebsocketMap((websocketMap: any) => {
                    Object.keys(websocketMap).map((dtm) => {
                      websocketMap[dtm].close();
                      delete websocketMap[dtm];
                    });
                    return {};
                  });
                  // 応答中状態を破棄
                  setWaitingMap({});
                  // 中断メッセージの表示(少しでも応答メッセージがあれば上書きはしない)
                  setChats((chats: any) => {
                    const messages = chats[chatid];
                    const updatedMsgs = messages.map((msg: any) =>
                      msg.role === "user" || msg.content ? msg : { ...msg, content: "応答の受信が中断されました。", isError: true },
                    );
                    chats[chatid] = updatedMsgs;
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
                    if (chats[chatid].length === 0) return;
                    if (settings.appSettings.copyChatOnMessageDeleteMode) {
                      // チャットメッージを削除モードに入る際にメッセージをコピーする
                      const newTitle: any = "copy_" + chatHistory.filter((chat: any) => chat.chatid === chatid)[0].title;
                      const uuid = self.crypto.randomUUID();
                      await saveChat(uuid, chats[chatid], systemInput, newTitle);
                    }
                    setMessagesOnDeleteMode(JSON.parse(JSON.stringify(chats[chatid])));
                    setIsMessageDeleteMode(true);
                  }}
                />
                <MaterialButton name="settings_applications" onClick={() => setOpenDrawer("drawerOne")} />
                <div className="flex justify-end cursor-pointer">
                  <span onClick={() => setOpenDrawer("drawerTwo")} style={{ padding: 6 }}>
                    <img src="../openai-logomark.svg" width="20" height="20" />
                  </span>
                </div>
                <div className="flex justify-end cursor-pointer">
                  <span onClick={() => setOpenDrawer("drawerThree")} style={{ padding: 0 }}>
                    <img src="../anthropic.ico" width="32" height="32" />
                  </span>
                </div>
              </>
            ) : (
              <>
                <MaterialButton
                  name="done"
                  onClick={async () => {
                    setChats((chats: any) => {
                      chats[chatid] = messagesOnDeleteMode;
                      return chats;
                    });
                    setIsMessageDeleteMode(false);
                    await saveChat(chatid, messagesOnDeleteMode, systemInput);
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
