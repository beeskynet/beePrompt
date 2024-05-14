import { atom } from "jotai";

export const modelsGens: { [key: string]: string } = {
  "gpt-3.5-turbo-1106": "gpt-3.5-turbo",
  "gpt-3.5-turbo-0125": "gpt-3.5-turbo",
  "gpt-4-1106-preview": "gpt-4-turbo",
  "gpt-4-0125-preview": "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09": "gpt-4-turbo",
  "gpt-4o-2024-05-13": "gpt-4-o",
  "anthropic.claude-instant-v1": "claude-instant-v1",
  "anthropic.claude-v2": "claude-v2",
  "anthropic.claude-v2:1": "claude-v2.1",
  "anthropic.claude-3-sonnet-20240229-v1:0": "claude-v3-sonnet",
  "claude-3-haiku-20240307": "claude-3-haiku",
  "claude-3-sonnet-20240229": "claude-3-sonnet",
  "claude-3-opus-20240229": "claude-3-opus",
};

export interface Message {
  chatid?: string;
  title?: string;
  content?: string | null;
  isError?: boolean;
  role?: string;
  dtm?: string;
  model?: string;
  done?: boolean;
}

// セレクトボックス様モデルリスト
export const models: { [key: string]: string } = { ...modelsGens };
// 古いモデルを消す
delete models["anthropic.claude-v2"];
delete models["gpt-3.5-turbo-1106"];
delete models["gpt-4-1106-preview"];
delete models["gpt-4-0125-preview"];
delete models["anthropic.claude-instant-v1"];
delete models["anthropic.claude-v2"];
delete models["anthropic.claude-v2:1"];
delete models["anthropic.claude-3-sonnet-20240229-v1:0"];

const initStatus: { [key: string]: boolean } = {};
Object.keys(models).map((model) => (initStatus[model] = true));

const submissionStatus = atom(initStatus);
//const selectedModel = atom("gpt-3.5-turbo-0125");
const selectedModel = atom("claude-3-haiku-20240307");
const isParallel = atom(false);
const waitingMap = atom({});
const isResponding = atom((get) => Object.values(get(waitingMap) as Array<number>).reduce((sum, element) => sum + element, 0) > 0);
const isMessageDeleteMode = atom(false);
const isChatsDeleteMode = atom(false);
const messagesOnDeleteMode = atom([]);
const chats = atom({});
const chatHistory = atom<Message[]>([]);
const chatid = atom("");
const systemInput = atom("");
const drawerOpen = atom<string | boolean | null>(null);
const settings = atom({
  modelSettings: {},
  appSettings: {
    copyChatOnMessageDeleteMode: false,
  },
});

export const AppAtoms = {
  submissionStatus,
  selectedModel,
  isParallel,
  waitingMap,
  isResponding,
  isMessageDeleteMode,
  isChatsDeleteMode,
  messagesOnDeleteMode,
  drawerOpen,
  settings,
  chats,
  chatHistory,
  chatid,
  systemInput,
};
