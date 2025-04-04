"use client";

import React, { useState, useRef, useEffect } from "react";
import { Avatar } from "@material-tailwind/react";
import { AppAtoms, models } from "lib/store";
import { useAtom } from "jotai";
import { fetchAppSync } from "lib/util";

function DropdownSelect() {
  const [isActive, setIsActive] = useState(false);
  const dropdownRef = useRef<HTMLInputElement>(null);
  const [submissionStatus, setSubmissionStatus] = useAtom(AppAtoms.submissionStatus);
  const [selectedModel, setSelectedModel] = useAtom(AppAtoms.selectedModel);
  const [isParallel, setIsParallel] = useAtom(AppAtoms.isParallel);
  const [settings, setSettings] = useAtom(AppAtoms.settings);

  const initModellSelection = async () => {
    try {
      const query = `
        query {
          getSettings
        }`;
      const data = await fetchAppSync({ query, variables: {} });
      const settings = JSON.parse(data.getSettings);
      if (settings) {
        setSelectedModel(settings.modelSelection.selectedModel);
        setIsParallel(settings.modelSelection.isParallel);
        setSubmissionStatus(settings.modelSelection.submissionStatus);
      }
      return settings;
    } catch (e) {
      console.error("getSettings() error", e);
    }
  };
  const initSettings = async () => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsActive(false);
      }
    };
    initModellSelection();
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  };
  useEffect(() => {
    initSettings();
  }, []);

  const handleDropdown = () => {
    setIsActive(!isActive);
  };

  const saveSettings = async (settings: string) => {
    try {
      // チャット保存
      const query = `
        mutation($settings:AWSJSON!) {
          putSettings(settings: $settings)
        }`;
      const variables = { settings: JSON.stringify(settings) };
      return await fetchAppSync({ query, variables });
    } catch (e) {
      console.error("save settings error", e);
    }
  };

  const selectOption = async (key: string) => {
    const copied = JSON.parse(JSON.stringify(settings));
    if (isParallel) {
      const newSubmissionStatus: Record<string, boolean> = {};

      // modelsに含まれるキーのみを処理
      Object.keys(models).forEach((modelKey) => {
        // 選択されたキーは反転、それ以外は現在の値を保持
        newSubmissionStatus[modelKey] = modelKey === key ? !submissionStatus[modelKey] : !!submissionStatus[modelKey];
      });

      setSubmissionStatus(newSubmissionStatus);
      copied.modelSelection.submissionStatus = newSubmissionStatus;
    } else {
      setSelectedModel(key);
      setIsActive(false);
      copied.modelSelection.selectedModel = key;
    }
    setSettings(copied);
    await saveSettings(copied);
  };

  const toggleParallel = async () => {
    const newIsParallel = !isParallel;
    setIsParallel(newIsParallel);
    const copied = JSON.parse(JSON.stringify(settings));
    copied.modelSelection.isParallel = newIsParallel;
    setSettings(copied);
    await saveSettings(copied);
  };

  return (
    <div className="container mx-auto text-center">
      <div className="dropdown w-52 inline-block relative" ref={dropdownRef}>
        <div className="select bg-white px-3 py-2 border rounded cursor-pointer" onClick={handleDropdown}>
          <div className="flex items-center gap-2 select-none">
            {isParallel ? (
              <>
                <Avatar src="./check.png" className="w-4 h-6 text-tiny" />
                <span className="ml-2">Parallel Submit</span>
              </>
            ) : (
              <>
                {selectedModel.startsWith("anthropic") || selectedModel.startsWith("claude") ? (
                  <Avatar src="./anthropic.ico" className="w-6 h-6 text-tiny" />
                ) : null}
                {selectedModel.startsWith("gpt") ? <Avatar src="./openai-logomark.svg" className="w-5 h-5 text-tiny mr-1" /> : null}
                {selectedModel.startsWith("command") ? <Avatar src="./cohere-logo.svg" className="w-5 h-5 text-tiny mr-1" /> : null}
                <span className="text-gray-700 select-none">{models[selectedModel]}</span>
              </>
            )}
          </div>
        </div>
        {isActive && (
          <ul className="dropdown-menu absolute w-full shadow-md border rounded bg-white z-10 select-none">
            {Object.keys(models).map((key) => (
              <li
                key={key}
                className={`flex items-center cursor-pointer ${isParallel && submissionStatus[key] ? "bg-blue-100" : "hover:bg-gray-100"}`}
                onClick={() => selectOption(key)}
              >
                {key.startsWith("anthropic") || key.startsWith("claude") ? <Avatar src="./anthropic.ico" className="mx-1 w-6 h-6 text-tiny" /> : null}
                {key.startsWith("gpt") || key.startsWith("o") ? <Avatar src="./openai-logomark.svg" className="mx-2 w-5 h-5 text-tiny" /> : null}
                {key.startsWith("command") ? <Avatar src="./cohere-logo.svg" className="mx-2 w-5 h-5 text-tiny" /> : null}
                <div className="my-2">{models[key]}</div>
              </li>
            ))}

            <li className="flex flex-row items-center cursor-pointer hover:bg-gray-100" onClick={toggleParallel}>
              {isParallel ? <Avatar src="./check.png" className="my-2 ml-2 w-4 h-6 text-tiny" /> : <div className="h-10 w-6" />}
              <span className="ml-2">Parallel Submit</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

export default DropdownSelect;
