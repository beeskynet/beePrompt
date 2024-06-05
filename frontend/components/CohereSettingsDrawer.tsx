import React, { Dispatch, SetStateAction } from "react";
import { Drawer, Button, Typography, IconButton } from "@material-tailwind/react";
import { AppAtoms } from "lib/store";
import { useAtom } from "jotai";
import { withAuthenticator } from "@aws-amplify/ui-react";

type Props = {
  temperatureCohere: number;
  setTemperatureCohere: Dispatch<SetStateAction<number>>;
};
const CohereSettingsDrawer: React.FC<Props> = ({ temperatureCohere, setTemperatureCohere }) => {
  const [open, setOpen] = useAtom(AppAtoms.drawerOpen);
  const closeDrawer = () => setOpen(false);

  const handleChangeTemperature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber;
    setTemperatureCohere(value);
  };
  const setDefaultParameter = () => {
    setTemperatureCohere(1);
  };

  if (open !== "CohereSettingDrawer") return null;
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
          Cohereパラメータ設定
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
          <div>{temperatureCohere}</div>
        </div>
        <input
          type="range"
          className="slider w-full"
          value={temperatureCohere}
          min="0"
          max="1"
          step="0.01"
          onChange={(e) => handleChangeTemperature(e)}
        />
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
export default withAuthenticator(CohereSettingsDrawer);
