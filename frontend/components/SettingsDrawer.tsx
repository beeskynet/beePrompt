import React, { useState, useEffect } from "react";
import { Drawer, Checkbox, Typography, IconButton } from "@material-tailwind/react";
import { AppAtoms } from "lib/store";
import { apiUrls } from "lib/environments";
import { useAtom } from "jotai";
import { fetchAuthSession } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";

function SettingsDrawer() {
  const [open, setOpen]: any = useAtom(AppAtoms.drawerOpen);
  const closeDrawer: any = () => setOpen(false);
  const [settings, setSettings]: any = useAtom(AppAtoms.settings);
  const [userid, setUserid]: any = useState();

  useEffect(() => {
    const initUserid = async () => {
      const session: any = await fetchAuthSession();

      // ユーザー情報取得
      const userid = session.tokens.accessToken.payload.sub;
      setUserid(userid);
    };
    initUserid();
  }, []);

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
  const saveSettings = async (userid: any, settings: any) => {
    try {
      // チャット保存
      const query = `
        mutation($userid:String!, $settings:AWSJSON!) {
          putSettings(userid: $userid, settings: $settings)
        }`;
      const variables = { userid, settings: JSON.stringify(settings) };
      return await fetchAppSync({ query, variables });
    } catch (e) {
      console.error("save settings error", e);
    }
  };

  if (open !== "drawerOne") return null;
  return (
    <Drawer
      open={!!open}
      onClose={closeDrawer}
      size={350}
      placement="right"
      className="p-4  border-l"
      overlay={false}
      transition={{ type: "spring", duration: 0.3 }} // https://www.framer.com/motion/transition/
    >
      <div className="mb-6 flex items-center justify-between">
        <Typography variant="h5" color="blue-gray">
          Settings
        </Typography>
        <IconButton variant="text" color="blue-gray" onClick={closeDrawer}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconButton>
      </div>
      <label className="flex">
        <Checkbox
          className="p-1"
          color="indigo"
          checked={settings.appSettings.copyChatOnMessageDeleteMode}
          onChange={async () => {
            const copied = JSON.parse(JSON.stringify(settings));
            copied.appSettings.copyChatOnMessageDeleteMode = !settings.appSettings.copyChatOnMessageDeleteMode;
            setSettings(copied);
            await saveSettings(userid, copied);
          }}
        />
        <span className="cursor-pointer select-none">メッセージ削除モードに入る際にチャットを複製する</span>
      </label>
    </Drawer>
  );
}
export default withAuthenticator(SettingsDrawer);
