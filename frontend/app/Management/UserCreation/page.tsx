"use client";

import React, { useState } from "react";
import { Typography, Button, Checkbox, Input } from "@material-tailwind/react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { apiUrls } from "lib/environments";

const UserCreationForm: React.FC = () => {
  interface Dict<T> {
    [key: string]: T;
  }
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const initialFormState = {
    username: "",
    email: "",
    isAdmin: false,
    initialPoints: 0,
    effectiveDays: 31,
  };
  const [formState, setFormState] = useState(initialFormState);

  const fetchAppSync = async ({ query, variables }: { query: string; variables?: Dict<string | number | boolean> }) => {
    const session = await fetchAuthSession();
    const res = await fetch(apiUrls.appSync, {
      method: "POST",
      headers: session.tokens?.accessToken ? { Authorization: session.tokens.accessToken.toString() } : undefined,
      body: JSON.stringify({ query, variables }),
    });
    const resJson = await res.json();
    if (resJson.errors) {
      console.error(resJson.errors[0].message, resJson.errors);
    }
    return resJson?.data;
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormState((prevState) => ({
      ...prevState,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, email, isAdmin, initialPoints, effectiveDays } = formState;
    const variables = { username, email, isAdmin, point: initialPoints, effective_days: effectiveDays };
    const query = `
      mutation($username:String!, $email:String!, $isAdmin: Boolean!, $point:Int!, $effective_days:Int!) {
        createUser(username: $username, email: $email, isAdmin: $isAdmin, point: $point, effective_days: $effective_days)
      }`;
    const res = await fetchAppSync({ query, variables });
    if (res?.createUser === "Success") {
      setMessage("ユーザーを作成しました。");
      setError(false);
      setFormState(initialFormState);
    } else {
      if (res?.createUser === "UsernameExistsException") {
        setMessage("ユーザーがすでに存在します。");
        setError(true);
      } else {
        console.error(res);
        setMessage("ユーザーの作成に失敗しました。");
        setError(true);
      }
    }
  };

  const buttonStyle = "bg-blue-400 border border-blue-600 shadow-none font-normal text-white";
  return (
    <div className="flex justify-center">
      <div className="flex flex-col max-h-screen" style={{ width: 500 }}>
        <div className="mt-3 font-bold">User Creation</div>
        <div className={`m-3 ${error ? "text-red-600" : "text-green-600"}`}>{message}</div>
        <form onSubmit={handleSubmit} className="max-w-xl">
          <div className="mb-4 mx-2">
            <Input
              type="text"
              name="username"
              label="UserID"
              value={formState.username}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="mb-4 mx-2">
            <Input
              type="email"
              name="email"
              label="Email"
              value={formState.email}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          <div className="mb-4">
            <label className="flex items-center">
              <Checkbox name="isAdmin" checked={formState.isAdmin} onChange={handleChange} className="p-1" color="indigo" />
              <span className="cursor-pointer select-none">管理者</span>
            </label>
          </div>

          <div className="flex flex-row gap-2 my-5 mx-2">
            <div className="mt-auto w-full">
              <div className="flex flex-row gap-x-2">
                <Input name="initialPoints" label="ポイント" value={formState.initialPoints} onChange={handleChange} />
                <Input name="effectiveDays" label="有効日数" value={formState.effectiveDays} onChange={handleChange} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end">
            <Button type="submit" className={`${buttonStyle} ml-3`}>
              Submit
            </Button>
          </div>
        </form>
        {/* 管理ページリンク */}
        <Typography as="li" color="blue-gray" className="font-normal my-2">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/Management");
            }}
            className="inline-block py-1 pr-2 transition-transform hover:scale-105"
          >
            To Management Page.
          </a>
        </Typography>
      </div>
    </div>
  );
};

export default UserCreationForm;
