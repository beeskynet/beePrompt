"use client";
import React, { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Typography } from "@material-tailwind/react";
import { useRouter } from "next/navigation";
import { apiUrls } from "lib/environments";

const skyBlue = "#a0d8ef";
const liteGray = "#EEEEEE";
const MONTHLY_ADDITIONAL_POINTS = 500;

const BalancePieChart = ({ remainingPoints, monthlyAdditonalPoints }: any) => {
  // カラーパターン
  const COLORS = [skyBlue, liteGray];
  const data = [
    { name: "残りポイント", value: remainingPoints },
    { name: "", value: monthlyAdditonalPoints < remainingPoints ? 0 : monthlyAdditonalPoints - remainingPoints },
  ];
  return (
    <div className="flex justify-center">
      <PieChart width={200} height={200} className="">
        <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={80} innerRadius={40} startAngle={-270} fill="#8884d8" dataKey="value">
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
          {`${(((remainingPoints * 1.0) / monthlyAdditonalPoints) * 100).toFixed(1)}%`}
        </text>
      </PieChart>
    </div>
  );
};

function UsageBarChart({ data }: any) {
  function fillMissingDays(data: any) {
    const today = new Date();
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - 30);

    const filledData = [];
    let currentDay = startDay;
    while (currentDay <= today) {
      const dayString = currentDay.toISOString().slice(0, 10);
      const existing = data.filter((d: any) => d.day === dayString)[0];
      if (existing) {
        filledData.push(existing);
      } else {
        filledData.push({
          day: dayString,
          usagePoint: 0,
        });
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }
    return filledData;
  }
  return (
    <div className="pr-10">
      <BarChart width={500} height={300} data={fillMissingDays(data)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="usagePoint" fill={skyBlue} />
      </BarChart>
    </div>
  );
}
function Usage() {
  const [userid, setUserid] = useState();
  const [smrDaily, setSmrDaily] = useState([]);
  const [smrMonthly, setSmrMonthly] = useState([]);
  const [balance, setBalance] = useState(0);
  const router = useRouter();

  const fetchAppSync = async ({ query, variables }: any) => {
    const session: any = await fetchAuthSession();
    const res = await fetch(apiUrls.appSync, {
      method: "POST",
      headers: { Authorization: session.tokens.accessToken.toString() },
      body: JSON.stringify({ query, variables }),
    });
    const resJson = await res.json();
    if (resJson.errors) {
      console.error(resJson.errors[0].message, resJson.errors);
    }
    return resJson?.data;
  };

  const init = async () => {
    const session: any = await fetchAuthSession();
    // ユーザー情報取得
    const userid = session.tokens.accessToken.payload.sub;
    setUserid(userid);

    //
    const getUsage = async () => {
      const query = `
        query {
          getUsage {
            smrDaily { day usagePoint }
            smrMonthly { month usagePoint }
          }
        }`;
      const res = await fetchAppSync({ query });
      setSmrDaily(res.getUsage.smrDaily);
      setSmrMonthly(res.getUsage.smrMonthly);
    };
    getUsage();

    // 残高取得
    const getBalances = async () => {
      const variables = { userids: [userid] };
      const query = `
            query($userids:[String]!) {
              getBalances(userids: $userids) {
                userid balance
              }
            }`;
      const res = await fetchAppSync({ query, variables });

      // 集計
      const sum = (nums: any) => nums.reduce((sum: any, num: any) => sum + num, 0);
      setBalance(sum(res.getBalances.map((balance: any) => balance.balance)));
    };
    getBalances();
  };
  useEffect(() => {
    init();
  }, []);

  return (
    <div>
      <div className="flex justify-center">
        <div className="flex flex-col">
          {/* 日次利用量 */}
          <span className="ml-6 p-2 font-bold">Daily Usage</span>
          <UsageBarChart data={smrDaily} />
          {/* 残高 */}
          <div className="mt-4">
            <span className="ml-24 p-2 font-bold">Balance</span>
            <div className="flex justify-center">
              <BalancePieChart remainingPoints={balance} monthlyAdditonalPoints={MONTHLY_ADDITIONAL_POINTS} />
              <div className="flex flex-col pt-4">
                <span className="text-xs font-bold">残り</span>
                <div className="flex items-center">
                  <span className="pr-1 text-sm font-bold">Pt</span>
                  <span className="font-bold">{`${balance.toFixed(1)}`}</span>
                </div>
                <span className="text-xs text-gray-700 pt-1">{`/ Pt ${MONTHLY_ADDITIONAL_POINTS}`}</span>
                <span className="pl-2 text-xs text-gray-700">(月次付加ポイント)</span>
              </div>
            </div>
          </div>
          {/* チャットページリンク */}
          <Typography as="li" color="blue-gray" className="font-normal ml-14 mt-3">
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
    </div>
  );
}
export default Usage;
