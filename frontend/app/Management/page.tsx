"use client";
import React, { useState, useEffect } from "react";
import { Input, Radio, Button } from "@material-tailwind/react";
import { fetchAuthSession } from "aws-amplify/auth";
import { apiUrls } from "lib/environments";
import { Typography } from "@material-tailwind/react";
import { useRouter } from "next/navigation";

function ManBalance() {
  const [userid, setUserid] = useState<string | undefined>();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [point, setPoint] = useState(500);
  const [effectiveDays, setEffectiveDays] = useState(31);
  const router = useRouter();
  interface Dict<T> {
    [key: string]: T;
  }
  interface User {
    sub: string;
    username: string;
    balance: number;
  }
  const fetchAppSync = async ({ query, variables }: { query: string; variables?: Dict<string | number> }) => {
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
    const session = await fetchAuthSession();
    // ユーザー情報取得
    const userid = session.tokens?.accessToken.payload.sub;
    setUserid(userid);

    const getPrivilegedUsers = async () => {
      const query = `
          query {
            getPrivilegedUsers {
              sub username email
            }
          }`;
      const res = await fetchAppSync({ query });
      const gotUsers = res.getPrivilegedUsers;
      const userids = gotUsers.map((user: Dict<string>) => user.sub);
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
        setUsers(gotUsers.map((user: Dict<string>) => ({ ...user, balance: balances[user.sub] })));
      };
      getBalances();
      await fetchAppSync({ query, variables });
    };
    getPrivilegedUsers();
  };
  useEffect(() => {
    init();
  }, []);

  const selectUser = (user: User) => () => {
    //console.info(user.sub);
    setSelected(user.sub);
  };
  const onChangePointInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/(?!^-)[^0-9]/g, ""); // 文頭のマイナスは許す
    const newValue = parseInt(e.target.value);
    setPoint(!isNaN(newValue) ? newValue : point);
  };
  const onChangeEffectiveDaysInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
    const newValue = parseInt(e.target.value);
    setEffectiveDays(!isNaN(newValue) ? newValue : effectiveDays);
  };
  const onSubmit = async () => {
    if (!selected) return;
    const query = `
      mutation($userid:String!, $point:Int!, $effective_days:Int!) {
        addBalance(userid: $userid, point: $point, effective_days: $effective_days)
      }`;
    const variables = { userid: selected, point, effective_days: effectiveDays };
    const res = await fetchAppSync({ query, variables });
    if (res.addBalance === "Success") {
      await init();
    }
  };
  const columns = ["username", "balance"];
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  const buttonStyle = "bg-blue-400 border border-blue-600 shadow-none font-normal text-white";
  return (
    <div className="flex justify-center">
      <div className="flex flex-col max-h-screen">
        <div className="flex justify-between m-1">
          <div className="my-2">ユーザー</div>
          <div />
          <div>
            <Button onClick={() => console.info("delete")} className={`${buttonStyle}`} disabled={!selected}>
              アクション：セレクトボックスにする
            </Button>
            <Button onClick={() => router.push("/Management/UserCreation")} className={`${buttonStyle} ml-3`}>
              作成
            </Button>
          </div>
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
                  <Radio
                    crossOrigin=""
                    id={`user${i}`}
                    label={user.username}
                    type="radio"
                    name="radio"
                    checked={selected === user.sub}
                    onChange={selectUser(user)}
                  />
                </div>
                <div className="border border-gray-200 flex items-center justify-end pr-3 -mb-px -mr-2px">
                  {user.balance ? Number(user.balance).toFixed(2) : ""}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex flex-row gap-2 mt-5">
          <div className="mt-auto">
            <div className="flex flex-row">
              <Input crossOrigin="" label="ポイント" value={point} onChange={onChangePointInput} />
              <Input crossOrigin="" label="有効日数" value={effectiveDays} onChange={onChangeEffectiveDaysInput} />
            </div>
          </div>
          <Button onClick={onSubmit} className={`${buttonStyle}`} disabled={!selected}>
            付与
          </Button>
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
    </div>
  );
}
export default ManBalance;
