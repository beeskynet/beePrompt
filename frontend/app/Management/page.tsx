"use client";
import React, { useState, useEffect } from "react";
import { Input, Button, Checkbox, Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import { fetchAuthSession } from "aws-amplify/auth";
import { apiUrls } from "lib/environments";
import { Typography } from "@material-tailwind/react";
import { useRouter } from "next/navigation";
import { ssgPagePath } from "lib/util";

function ManBalance() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [checked, setChecked] = useState<Dict<boolean>>({});
  const [point, setPoint] = useState<number | string>(500);
  const [effectiveDays, setEffectiveDays] = useState<number | "">(31);
  const [open, setOpen] = React.useState(false);
  const confirmDeletion = () => setOpen(true);
  const router = useRouter();
  interface Dict<T> {
    [key: string]: T;
  }
  interface User {
    sub: string;
    username: string;
    balance?: number;
  }
  const fetchAppSync = async ({ query, variables }: { query: string; variables?: Dict<string | number | string[]> }) => {
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

  const init = async () => {
    const getPrivilegedUsers = async () => {
      const query = `
          query {
            getPrivilegedUsers{
              sub username email
            }
          }`;
      const res = await fetchAppSync({ query });
      const gotUsers = res.getPrivilegedUsers;
      const userids = gotUsers.map((user: User) => user.sub);
      const variables = { userids };
      const getBalances = async () => {
        const query = `
            query($userids:[String]!) {
              getBalances(userids: $userids) {
                userid balance
              }
            }`;
        const res = await fetchAppSync({ query, variables });
        // 残高集計(ユーザー別)
        const balances = res.getBalances.reduce((dic: Dict<string>, balance: Dict<string>) => {
          dic[balance.userid] = balance.userid in dic ? dic[balance.userid] + balance.balance : balance.balance;
          return dic;
        }, {});
        setUsers(gotUsers.map((user: User) => ({ ...user, balance: balances[user.sub] })));
      };
      getBalances();
    };
    getPrivilegedUsers();
  };
  useEffect(() => {
    init();
  }, []);

  const checkUser = (user: User) => () => {
    setChecked({ ...checked, [user.sub]: !checked[user.sub] });
  };
  const onChangePointInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value.replace(/(?!^-)[^0-9]/g, ""); // 文頭のマイナスは許す
    const num = parseInt(str);
    setPoint(["", "-"].includes(str) ? str : num);
  };
  const onChangeEffectiveDaysInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value.replace(/[^0-9]/g, "");
    const num = parseInt(str);
    setEffectiveDays(str === "" ? str : num);
  };
  const checkedIds = () => Object.keys(checked).filter((userid) => checked[userid]);
  const onSubmit = async () => {
    if (checkedIds().length < 1) return;
    setChecked({});
    if (typeof point !== "number" || typeof effectiveDays !== "number") return;
    const query = `
      mutation($userids:[String]!, $point:Int!, $effective_days:Int!) {
        addBalance(userids: $userids, point: $point, effective_days: $effective_days)
      }`;
    const variables = { userids: checkedIds(), point, effective_days: effectiveDays };
    const res = await fetchAppSync({ query, variables });
    if (res.addBalance === "Success") {
      setMessage("ポイント付与しました。");
      setError(false);
      await init();
    } else {
      setMessage("ポイント付与に失敗しました。");
      setError(true);
      console.error(res.addBalance);
    }
  };
  const getOnDelete = () => {
    let onProcessing = false;
    const onDelete = async () => {
      setOpen(false);
      setMessage("");
      if (onProcessing) return;
      onProcessing = true;

      if (checkedIds().length < 1) return;
      const idsForDelete = checkedIds();
      setChecked({});
      const query = `
        mutation($usernames:[String]!) {
          deleteUsers(usernames: $usernames)
        }`;
      const variables = { usernames: users.filter((user) => idsForDelete.includes(user.sub)).map((user) => user.username) };
      const res = await fetchAppSync({ query, variables });
      if (res.deleteUsers === "Success") {
        setMessage("ユーザーを削除しました。");
        setError(false);
        setUsers(users.filter((user) => !idsForDelete.includes(user.sub)));
        // CognitoユーザーリストのDB転記情報を更新
        const query = `
          mutation { updatePrivilegedUsers }`;
        fetchAppSync({ query });
      } else {
        setMessage("ユーザー削除に失敗しました。");
        setError(true);
        console.error(res.deleteUsers);
      }
      onProcessing = false;
    };
    return onDelete;
  };

  const columns = ["username", "balance"];
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  const buttonStyle = "bg-blue-400 border border-blue-600 shadow-none font-normal text-white";
  return (
    <div className="flex justify-center">
      <div className="flex flex-col max-h-screen">
        <div className="flex justify-between m-1">
          <div className="mt-2 font-bold">ユーザー管理</div>
          <div>
            <Button onClick={confirmDeletion} className={`${buttonStyle}`} disabled={checkedIds().length < 1}>
              削除
            </Button>
            <Button onClick={() => router.push(ssgPagePath("/Management/UserCreation"))} className={`${buttonStyle} ml-1`}>
              作成
            </Button>
          </div>
        </div>

        {/* ポイント付与 */}
        <div className="flex flex-row gap-1 mr-1">
          <div className="mt-auto">
            <div className="flex flex-row gap-1">
              <Input label="ポイント" value={point} onChange={onChangePointInput} />
              <Input label="有効日数" value={effectiveDays} onChange={onChangeEffectiveDaysInput} />
            </div>
          </div>
          <Button onClick={onSubmit} className={`${buttonStyle}`} disabled={checkedIds().length < 1}>
            付与
          </Button>
        </div>

        {/* 処理結果メッセージ */}
        <div className={`my-2 ${error ? "text-red-600" : "text-green-600"}`} style={{ height: 28 }}>
          {message}
        </div>

        {/* ヘッダー */}
        <div className="" style={{ width: 480 }}>
          <div className="grid" style={{ gridTemplateColumns: "2fr 0.7fr" }}>
            {columns.map((col, i) => (
              <div key={`h-${i}`} className={`bg-gray-200 p-2 border`}>
                {capitalize(col)}
              </div>
            ))}
          </div>
        </div>

        {/* データ */}
        <div className="overflow-y-auto" style={{ width: 480, height: "calc(100% - 150px)" }}>
          <div className="grid" style={{ gridTemplateColumns: "2fr 0.7fr" }}>
            {users.map((user: User, i: number) => (
              <React.Fragment key={`d-${i}`}>
                <div className="border border-gray-200 -mb-px -mr-px">
                  <Checkbox color="indigo" id={`user${i}`} label={user.username} checked={!!checked[user.sub]} onChange={checkUser(user)} />
                </div>
                <div className="border border-gray-200 flex items-center justify-end pr-3 -mb-px -mr-2px">
                  {user.balance ? Number(user.balance).toFixed(2) : ""}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* チャットページリンク */}
        <Typography as="li" color="blue-gray" className="font-normal my-2">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/");
            }}
            className="inline-block py-1 pr-2 transition-transform hover:scale-105"
          >
            To Chat Page.
          </a>
        </Typography>
      </div>

      {/* ユーザー削除確認ダイアログ */}
      <Dialog open={open} handler={() => setOpen(false)}>
        <DialogHeader>下記ユーザーを削除します</DialogHeader>
        <DialogBody>
          {users
            .filter((user) => checkedIds().includes(user.sub))
            .map((user) => user.username)
            .join(", ")}
        </DialogBody>
        <DialogFooter>
          <Button variant="text" color="red" onClick={() => setOpen(false)} className="mr-1">
            <span>Cancel</span>
          </Button>
          <Button variant="gradient" color="green" onClick={getOnDelete()}>
            <span>OK</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
export default ManBalance;
