import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import { Drawer, Button, Typography, IconButton } from "@material-tailwind/react";
import { AppAtoms } from "lib/store";
import { useAtom } from "jotai";
import { fetchAuthSession } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";

type Props = {
  temperatureClaude: number;
  setTemperatureClaude: Dispatch<SetStateAction<number>>;
};
const ClaudeSettingsDrawer: React.FC<Props> = ({ temperatureClaude, setTemperatureClaude }) => {
  const [open, setOpen] = useAtom(AppAtoms.drawerOpen);
  const closeDrawer = () => setOpen(null);
  const [, setUserid] = useState<string | null>();

  useEffect(() => {
    const initUserid = async () => {
      const session = await fetchAuthSession();

      // ユーザー情報取得
      const userid = session.tokens?.accessToken.payload.sub;
      setUserid(userid);
    };
    initUserid();
  }, []);

  const handleChangeTemperature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber;
    setTemperatureClaude(value);
  };
  /*
  const handleChangeTopP = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber;
    setTopPClaude(value);
  };
  const handleChangeTopK = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber;
    setTopKClaude(value);
  };
   */
  const setDefaultParameter = () => {
    setTemperatureClaude(1);
    //setTopPClaude(0.999);
    //setTopKClaude(250);
  };

  if (open !== "drawerThree") return null;
  return (
    <Drawer
      open={!!open}
      onClose={closeDrawer}
      size={300}
      placement="right"
      className="p-4  border-l"
      overlay={false}
      transition={{ type: "spring", duration: 0.3 }} // https://www.framer.com/motion/transition/
    >
      <div className="mb-6 flex items-center justify-between">
        <Typography variant="h5" color="blue-gray">
          Claudeパラメータ設定
        </Typography>
        <IconButton variant="text" color="blue-gray" onClick={closeDrawer}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconButton>
      </div>
      <Typography as="li" color="blue-gray" className="font-normal ml-4 mt-3">
        <div className="mb-6 flex items-center justify-between">
          <p>Temperature</p>
          <div>{temperatureClaude}</div>
        </div>
        <input
          type="range"
          className="slider w-full"
          value={temperatureClaude}
          min="0"
          max="1"
          step="0.01"
          onChange={(e) => handleChangeTemperature(e)}
        />
        {/*
        <div className="mb-6 flex items-center justify-between">
          <p>top P</p>
          <div>{topPClaude}</div>
        </div>
        <input type="range" className="slider w-full" value={topPClaude} min="0" max="1" step="0.001" onChange={(e) => handleChangeTopP(e)} />
        <div className="mb-6 flex items-center justify-between">
          <p>top K</p>
          <div>{topKClaude}</div>
        </div>
        <input type="range" className="slider w-full" value={topKClaude} min="0" max="500" step="1" onChange={(e) => handleChangeTopK(e)} />
         */}
        <br></br>
      </Typography>
      <div className="p-5 pr-2 mt-auto">
        <Button
          onClick={setDefaultParameter}
          className="py-1 px-2 bg-blue-400 border border-blue-600 shadow-none font-normal text-white rounded h-10 hover:shadow-none"
        >
          Reset Parameter
        </Button>
      </div>
    </Drawer>
  );
};
export default withAuthenticator(ClaudeSettingsDrawer);
