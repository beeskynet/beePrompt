import { atom } from "jotai";

export const modelsGens: { [key: string]: string } = {
  // 履歴表示のためにここには過去のモデルも残しておく
  "gpt-3.5-turbo-1106": "gpt-3.5-turbo",
  "gpt-3.5-turbo-0125": "gpt-3.5-turbo",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4-1106-preview": "gpt-4-turbo",
  "gpt-4-0125-preview": "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09": "gpt-4-turbo",
  "gpt-4o-2024-05-13": "gpt-4o",
  "gpt-4o-2024-08-06": "gpt-4o",
  "gpt-4.5-preview-2025-02-27": "gpt-4.5-preview",
  "o1-mini-2024-09-12": "gpt-o1-mini",
  "o1-preview-2024-09-12": "gpt-o1-preview",
  //"o3-mini-2025-01-31": "gpt-o3-mini",
  "anthropic.claude-instant-v1": "claude-instant-v1",
  "anthropic.claude-v2": "claude-v2",
  "anthropic.claude-v2:1": "claude-v2.1",
  "anthropic.claude-3-sonnet-20240229-v1:0": "claude-v3-sonnet",
  "claude-3-haiku-20240307": "claude-3-haiku",
  "claude-3-sonnet-20240229": "claude-3-sonnet",
  "claude-3-5-haiku-20241022": "claude-3.5-haiku",
  "claude-3-5-sonnet-20240620": "claude-3.5-sonnet",
  "claude-3-5-sonnet-20241022": "claude-3.5-sonnet",
  "claude-3-7-sonnet-20250219": "claude-3.7-sonnet",
  "claude-3-opus-20240229": "claude-3-opus",
  "command-r-plus": "command-R+",
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

// チャットデータのインターフェース
export interface Chats {
  [key: string]: Message[];
}

// セレクトボックス様モデルリスト
export const models: { [key: string]: string } = { ...modelsGens };
// 古いモデルを消す
delete models["anthropic.claude-v2"];
delete models["gpt-3.5-turbo-1106"];
delete models["gpt-3.5-turbo-0125"];
delete models["gpt-4-1106-preview"];
delete models["gpt-4-0125-preview"];
delete models["gpt-4-turbo-2024-04-09"];
delete models["anthropic.claude-instant-v1"];
delete models["anthropic.claude-v2"];
delete models["anthropic.claude-v2:1"];
delete models["gpt-4-1106-preview"];
delete models["gpt-4-0125-preview"];
delete models["gpt-4-turbo-2024-04-09"];
delete models["gpt-4o-2024-05-13"];
delete models["anthropic.claude-instant-v1"];
delete models["anthropic.claude-v2"];
delete models["anthropic.claude-v2:1"];
delete models["anthropic.claude-3-sonnet-20240229-v1:0"];
delete models["claude-3-sonnet-20240229"];
delete models["claude-3-haiku-20240307"];
delete models["claude-3-5-sonnet-20240620"];
delete models["claude-3-5-sonnet-20241022"];

const initStatus: { [key: string]: boolean } = {};
Object.keys(models).map((model) => (initStatus[model] = true));

const submissionStatus = atom(initStatus);
const selectedModel = atom("gpt-4o-2024-08-06");
const isParallel = atom(false);
const waitingMap = atom({});
const isResponding = atom((get) => Object.values(get(waitingMap) as Array<number>).reduce((sum, element) => sum + element, 0) > 0);
const isMessageDeleteMode = atom(false);
const isChatsDeleteMode = atom(false);
const messagesOnDeleteMode = atom([]);
const frontChat = atom<Message[]>([]); // 表示用のチャットアトム
const richChats = atom<Chats>({}); // 並列処理用の内部状態を持つチャットアトム
const chatHistory = atom<Message[]>([]);
const chatid = atom("");
const systemInput = atom("");
const drawerOpen = atom<string | boolean | null>(null);
const activeChatIdRef = atom("");
const settings = atom({
  modelSettings: {},
  appSettings: {
    copyChatOnMessageDeleteMode: false,
  },
  modelSelection: {
    selectedModel: "",
    isParallel: false,
    submissionStatus: {},
  },
});

// サイドバー表示状態を変更するための関数を保持するatom
const sidebarDisplayChange = atom<((display: boolean) => void) | null>(null);

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
  frontChat,
  richChats,
  chatHistory,
  chatid,
  systemInput,
  sidebarDisplayChange,
  activeChatIdRef,
};
