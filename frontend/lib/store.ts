import { atom } from "jotai";

export const modelsGens: any = {
  "gpt-3.5-turbo-1106": "gpt-3.5-turbo",
  "gpt-3.5-turbo-0125": "gpt-3.5-turbo",
  "gpt-4-1106-preview": "gpt-4-turbo",
  "gpt-4-0125-preview": "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09": "gpt-4-turbo",
  "anthropic.claude-instant-v1": "claude-instant-v1",
  "anthropic.claude-v2": "claude-v2",
  "anthropic.claude-v2:1": "claude-v2.1",
  "anthropic.claude-3-sonnet-20240229-v1:0": "claude-v3-sonnet",
  "claude-3-haiku-20240307": "claude-3-haiku",
  "claude-3-sonnet-20240229": "claude-3-sonnet",
  "claude-3-opus-20240229": "claude-3-opus",
};

// セレクトボックス様モデルリスト
export const models: any = { ...modelsGens };
// 古いモデルを消す
delete models["anthropic.claude-v2"];
delete models["gpt-3.5-turbo-1106"];
delete models["gpt-4-1106-preview"];
delete models["gpt-4-0125-preview"];
delete models["anthropic.claude-instant-v1"];
delete models["anthropic.claude-v2"];
delete models["anthropic.claude-v2:1"];
delete models["anthropic.claude-3-sonnet-20240229-v1:0"];

const initStatus: any = {};
Object.keys(models).map((model) => (initStatus[model] = true));

const submissionStatus: any = atom(initStatus);
//const selectedModel: any = atom("gpt-3.5-turbo-0125");
const selectedModel: any = atom("claude-3-haiku-20240307");
const isParallel: any = atom(false);
const waitingMap: any = atom({});
const isResponding: any = atom((get) => Object.values(get(waitingMap) as Array<number>).reduce((sum, element) => sum + element, 0) > 0);
const isMessageDeleteMode: any = atom(false);
const isChatsDeleteMode: any = atom(false);
const messagesOnDeleteMode: any = atom([]);
const chats: any = atom({});
const chatHistory: any = atom([]);
const chatid: any = atom("");
const systemInput: any = atom("");
const drawerOpen: any = atom(null);
const settings: any = atom({
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
