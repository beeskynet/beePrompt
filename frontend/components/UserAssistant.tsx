"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Avatar } from "@material-tailwind/react";
import Markdown from "./Markdown";
import MaterialButton from "./MaterialButton";
import { modelsGens, AppAtoms, Message } from "lib/store";
import { useSetAtom, useAtomValue } from "jotai";
import { NextPage } from "next";

interface MessageProp {
  message: Message
}

const Message: NextPage<MessageProp> = ({ message }) => {
  if (message.content == null) {
    const promise = new Promise(() => { }); // "Uncaught (in promise) Error ~"出力抑止
    promise.catch(function () { });
    throw promise;
  }

  if (message.isError) {
    return <p className="text-left whitespace-pre-wrap mt-1 text-red-600">{message.content}</p>;
  } else if (message.role === "user") {
    return <p className="text-left whitespace-pre-wrap mt-1">{message.content}</p>;
  }
  return <>{message.content !== "" ? <Markdown>{message.content}</Markdown> : <div style={{ height: 26 }} />}</>;
};

const WaitingMessage: NextPage<MessageProp> = ({ message }) => {
  /*
   * open ai apiのタイムアウトは10分であることを確認。
   * ただし10分間、最初のレスポンスもないケースが多いようなので
   * 3分でゲージの表示を停止して遅延の旨のメッセージ表示に切り替え。
   */
  const SLEEP_MSEC = 200; // ループの間隔 (ms)
  const TIMEOUT = 180000; // タイムアウト=3分=180000ms
  const gages = [" ....", ". ...", ".. ..", "... .", ".... ", "....."];

  // 初期状態を設定
  const [gage, setGage] = useState(gages[0]);
  const [isTimeout, setIsTimeout] = useState(false);

  const setWaitingMap = useSetAtom(AppAtoms.waitingMap);

  useEffect(() => {
    setWaitingMap((waitingMap: MessageProp) => ({ ...waitingMap, [message.dtm + ""]: 1 }));
    // アニメーションのループ処理
    let currentIndex = 0;
    const intervalId = setInterval(() => {
      currentIndex++;
      setGage(gages[currentIndex % gages.length]);
    }, SLEEP_MSEC);

    // タイムアウト処理
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId); // アニメーションを停止する
      setIsTimeout(true); // タイムアウト状態にする
    }, TIMEOUT);

    // コンポーネントアンマウント時のクリーンアップ関数
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (isTimeout) {
      setWaitingMap((waitingMap: MessageProp) => ({ ...waitingMap, [message.dtm + ""]: 0 }));
    }
  }, [isTimeout]);

  // スタイルを動的に適用
  const fontStyle = isTimeout ? "text-red-600" : "font-bold";
  const style = `text-left whitespace-pre-wrap mt-1 ${fontStyle}`;

  // タイムアウト状態に応じてテキストを表示
  return <p className={style}>{!isTimeout ? gage : "Response is too late."}</p>;
};

const UserAssistant: NextPage<MessageProp> = ({ message }) => {
  const setMessagesOnDeleteMode = useSetAtom(AppAtoms.messagesOnDeleteMode);
  const isMessageDeleteMode = useAtomValue(AppAtoms.isMessageDeleteMode);
  const copyMessage = (message: Message) => () => {
    navigator.clipboard.writeText(message.toString());
  };
  const deleteMessage =
    ({ dtm, role }: { dtm?: string, role?: string }) =>
      () => {
        setMessagesOnDeleteMode((messages) => messages.filter((msg: Message) => msg.dtm !== dtm || msg.role !== role));
      };
  return (
    <div
      className={`mb-1 ml-2 p-2 w-max-full rounded-md relative  bg-neutral-100 border group ${message.role === "user" ? "border-indigo-100" : "border-pink-100"
        }`}
    >
      {!isMessageDeleteMode ? (
        <MaterialButton name="content_copy" className="absolute top-1 right-1 invisible" groupHoverVisible onClick={copyMessage(message)} />
      ) : (
        <MaterialButton name="delete" className="absolute top-1 right-1" onClick={deleteMessage(message)} />
      )}
      <div className="mb-2 flex items-center">
        {message.model && (message.model.startsWith("anthropic") || message.model.startsWith("claude")) ? (
          <Avatar src="./anthropic.ico" className="w-6 h-6 text-tiny" />
        ) : null}
        {message.model && message.model.startsWith("gpt") ? <Avatar src="./openai-logomark.svg" className="w-5 h-5 text-tiny" /> : null}
        <p className="text-left text-sm ml-1 text-gray-600">{message.model ? modelsGens[message.model].toUpperCase() : "YOU"}</p>
      </div>
      <Suspense fallback={<WaitingMessage message={message} />}>
        <Message message={message} />
      </Suspense>
    </div>
  );
};

export default UserAssistant;
