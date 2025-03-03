import React from "react";
import MaterialButton from "./MaterialButton";
import { AppAtoms, Message } from "lib/store";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useChat } from "../hooks/useChat";

interface ToolBarProps {
  disconnectAllWebSockets: (activeChatId: string) => void;
}

/**
 * ツールバーコンポーネント
 * チャットの操作に関する各種ボタンを提供します
 */
const ToolBar: React.FC<ToolBarProps> = ({ disconnectAllWebSockets }) => {
  // Atoms
  const [isMessageDeleteMode, setIsMessageDeleteMode] = useAtom(AppAtoms.isMessageDeleteMode);
  const [messagesOnDeleteMode, setMessagesOnDeleteMode] = useAtom(AppAtoms.messagesOnDeleteMode);
  const [richChats] = useAtom(AppAtoms.richChats);
  const [settings] = useAtom(AppAtoms.settings);
  const [chatHistory] = useAtom(AppAtoms.chatHistory);
  const setOpenDrawer = useSetAtom(AppAtoms.drawerOpen);
  const isResponding = useAtomValue(AppAtoms.isResponding);

  // Hooks
  const { saveChat, updateChats, activeChatId } = useChat();

  return (
    <div id="tool-bar" className="flex flex-col align-start w-10 flex-shrink-0">
      {isResponding ? <MaterialButton name="block" onClick={async () => disconnectAllWebSockets(activeChatId)} /> : null}
      {!isMessageDeleteMode ? (
        <>
          <MaterialButton
            name="delete"
            disabled={isResponding}
            onClick={async () => {
              if (richChats[activeChatId].length === 0) return;
              if (settings.appSettings.copyChatOnMessageDeleteMode) {
                // チャットメッージを削除モードに入る際にメッセージをコピーする
                const newTitle = "copy_" + chatHistory.filter((chat: Message) => chat.chatid === activeChatId)[0].title;
                const uuid = self.crypto.randomUUID();
                await saveChat(uuid, richChats[activeChatId], "", newTitle);
              }
              setMessagesOnDeleteMode(JSON.parse(JSON.stringify(richChats[activeChatId])));
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
              updateChats((chats: { [key: string]: Message[] }) => {
                chats[activeChatId] = messagesOnDeleteMode;
                return chats;
              });
              setIsMessageDeleteMode(false);
              await saveChat(activeChatId, messagesOnDeleteMode, "");
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
  );
};

export default ToolBar;

