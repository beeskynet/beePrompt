"use client";
import React, { useState, useRef, useEffect, MutableRefObject } from "react";
import UserAssistant from "./UserAssistant";
import DropdownSelect from "./DropdownSelect";
import { Button } from "@material-tailwind/react";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";
import { AppAtoms, Message, Chats, models } from "lib/store";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import MaterialButton from "./MaterialButton";
import SettingsDrawer from "./SettingsDrawer";
import OpenAiSettingsDrawer from "./OpenAiSettingsDrawer";
import ClaudeSettingsDrawer from "./ClaudeSettingsDrawer";
import CohereSettingsDrawer from "./CohereSettingsDrawer";
import MenuDrawer from "./MenuDrawer";
import MobileDrawer from "./MobileDrawer";
import ChatHistory from "./ChatHistory";
import useOnWindowRefocus from "lib/useOnWindowReforcus";
import { useChat } from "../hooks/useChat";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSubmit } from "../hooks/useSubmit";
import ToolBar from "./ToolBar";

function Playground() {
  useOnWindowRefocus(async () => {
    const session = await fetchAuthSession();
    if (!session.tokens) {
      alert("セッションが終了しました。ログインしてください。");
      signOut();
    }
  });
  const [userInput, setUserInput] = useState("");
  const [frontChat, _setFrontChat] = useAtom(AppAtoms.frontChat); // 画面表示用チャット内容
  const [richChats, _setRichChats] = useAtom(AppAtoms.richChats); // 並列メッセージ受信によるメッセージ欠落を防ぐため、内部的にチャット内容を保持

  const [messagesOnDeleteMode, _setMessagesOnDeleteMode] = useAtom(AppAtoms.messagesOnDeleteMode);
  const [systemInput, setSystemInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [sidebarContent, setSidebarContent] = useState("history");
  const [sidebarDisplay, setSidebarDisplay] = useState(true);
  // サイドバー表示状態変更コールバックをatomにセット
  const [_, setSidebarDisplayChange] = useAtom(AppAtoms.sidebarDisplayChange);

  // useChat フックを初期化
  const { getChatHistory, displayChat, updateChats, fetchAppSync, newChat, setPagesChatId, activeChatId } = useChat();

  const [_chatHistory, setChatHistory] = useAtom(AppAtoms.chatHistory);
  const [isAdmin, setIsAdmin] = useState(false);
  const selectedModel = useAtomValue(AppAtoms.selectedModel);
  const isParallel = useAtomValue(AppAtoms.isParallel);
  const submissionStatus = useAtomValue(AppAtoms.submissionStatus);
  const isResponding = useAtomValue(AppAtoms.isResponding);
  const [isMessageDeleteMode, _setIsMessageDeleteMode] = useAtom(AppAtoms.isMessageDeleteMode);
  const setOpenDrawer = useSetAtom(AppAtoms.drawerOpen);
  const [_settings, setSettings] = useAtom(AppAtoms.settings);

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
  const container = useRef<HTMLDivElement | null>(null);

  systemInputRef.current = systemInput;

  // コンポーネントマウント時にsidebarDisplayChangeを設定
  useEffect(() => {
    setSidebarDisplayChange(() => setSidebarDisplay);
  }, [setSidebarDisplayChange]);

  // スクロールをページ下部に移動する関数
  const scrollToBottom = () => {
    if (!autoScrollRef.current) return;
    setTimeout(() => {
      const messagesContainer = document.querySelector("#messages-container");
      messagesContainer?.scrollTo(0, messagesContainer.scrollHeight);
    }, 0);
  };

  // WebSocketフックを初期化
  const { disconnectAllWebSockets, createWebSocketConnection } = useWebSocket({
    systemInputRef,
  });

  // Submitフックを初期化
  const { submit } = useSubmit();

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

  const handleUserSubmit = async () => {
    if (!userInput) return;
    setUserInput(""); // 2重処理抑止のために最初に
    if (isParallel && Object.values(submissionStatus).filter((status) => status).length === 0) {
      alert("AIモデルを選択してください。");
      return;
    }
    // チャット履歴欄に追加
    setChatHistory((chatHistory: Message[]) => {
      if (chatHistory.filter((chat: Message) => chat.chatid === activeChatId).length > 0) {
        return chatHistory;
      }
      return [{ chatid: activeChatId, title: "...waiting AI response..." }, ...chatHistory];
    });
    // ユーザーメッセージ追加
    const userDtm = new Date().toISOString();
    updateChats((chats: Chats) => {
      const messages = chats[activeChatId];
      chats[activeChatId] = [...messages, { role: "user", content: userInput, dtm: userDtm }];
      return chats;
    });

    // 温度や罰則の設定をまとめる
    const temperature = {
      gpt: temperatureGpt,
      claude: temperatureClaude,
      cohere: temperatureCohere,
    };

    const penalties = {
      topP: topPGpt,
      frequencyPenalty: frequencyPenaltyGpt,
      presencePenalty: presencePenaltyGpt,
    };

    // 非並列処理の場合
    if (!isParallel) {
      submit({
        model: selectedModel,
        userDtm,
        userInput,
        systemInput,
        activeChatId,
        richChats,
        setChats: updateChats,
        scrollToBottom,
        createWebSocketConnection,
        temperature,
        penalties,
      });
    } else {
      // 並列処理の場合
      for (const [i, model] of Object.entries(Object.keys(models))) {
        if (submissionStatus[model]) {
          setTimeout(
            () =>
              submit({
                model,
                userDtm,
                userInput,
                systemInput,
                activeChatId,
                richChats,
                setChats: updateChats,
                scrollToBottom,
                createWebSocketConnection,
                temperature,
                penalties,
              }),
            parseInt(i) * 100,
          );
        }
      }
    }
  };

  const toggleSidebar = () => {
    const content = sidebarContent === "history" ? "edit" : "history";
    setSidebarContent(content);
  };
  const toggleDisplaySidebar = () => {
    setSidebarDisplay(!sidebarDisplay);
  };

  const msgsOnDisplay = !isMessageDeleteMode ? frontChat : messagesOnDeleteMode;
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

          {/* 履歴エリア - ChatHistoryコンポーネントを更新 */}
          <ChatHistory container={container} sidebarDisplay={sidebarDisplay} sidebarContent={sidebarContent} systemInput={systemInput} />
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
          <ToolBar disconnectAllWebSockets={disconnectAllWebSockets} />
        </div>
      </div>
    </div>
  );
}

export default withAuthenticator(Playground);
