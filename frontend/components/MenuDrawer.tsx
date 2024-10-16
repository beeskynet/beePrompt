"use client";
import React, { useState, useEffect } from "react";
import { Drawer, List, ListItem } from "@material-tailwind/react";
import { AppAtoms } from "lib/store";
import { useAtom } from "jotai";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";
import { useRouter } from "next/navigation";
import { ssgPagePath } from "lib/util";

const MenuDrawer: React.FC = () => {
  const [open, setOpen] = useAtom(AppAtoms.drawerOpen);
  const closeDrawer = () => setOpen(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const session = await fetchAuthSession();
      const cognitoGroups = Array.isArray(session?.tokens?.accessToken?.payload?.["cognito:groups"])
        ? session.tokens.accessToken.payload["cognito:groups"]
        : [];
      setIsAdmin(cognitoGroups.includes("admin"));
    };
    init();
  }, []);

  if (open !== "drawerZero") return null;
  return (
    <Drawer
      open={!!open}
      onClose={closeDrawer}
      size={250}
      placement="right"
      className="text-sm"
      overlay={false}
      transition={{ type: "spring", duration: 0.3 }} // https://www.framer.com/motion/transition/
    >
      <List>
        {isAdmin ? (
          <ListItem className="text-sm" onClick={() => router.push(ssgPagePath("/Management"))}>
            Management
          </ListItem>
        ) : null}
        <ListItem className="text-sm" onClick={() => router.push(ssgPagePath("/Usage"))}>
          Usage
        </ListItem>
        <ListItem
          className="text-sm"
          onClick={() => {
            signOut();
            setOpen(false);
          }}
        >
          Sign Out
        </ListItem>
      </List>
    </Drawer>
  );
};

export default withAuthenticator(MenuDrawer);
