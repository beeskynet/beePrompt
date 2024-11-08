"use client";
import React, { useState, useEffect } from "react";
import { Drawer, List, ListItem } from "@material-tailwind/react";
import { AppAtoms } from "lib/store";
import { useAtom } from "jotai";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { ssgPagePath } from "lib/util";

type Props = {
  toggleHistory: () => void;
  newChat: () => void;
};
const MobileDrawer: React.FC<Props> = ({ toggleHistory, newChat }) => {
  const [open, setOpen] = useAtom(AppAtoms.drawerOpen);
  const closeDrawer = () => setOpen(false);

  if (open !== "drawerMobile") return null;
  return (
    <Drawer
      open={!!open}
      onClose={closeDrawer}
      size={250}
      placement="left"
      className="text-sm"
      overlay={false}
      transition={{ type: "spring", duration: 0.3 }} // https://www.framer.com/motion/transition/
    >
      <List>
        <ListItem
          className="text-sm"
          onClick={() => {
            toggleHistory();
            closeDrawer();
          }}
        >
          History
        </ListItem>
        <ListItem
          className="text-sm"
          onClick={() => {
            newChat();
            closeDrawer();
          }}
        >
          New Chat
        </ListItem>
      </List>
    </Drawer>
  );
};

export default MobileDrawer;
