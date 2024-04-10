"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppAtoms } from "lib/store";
import { useSetAtom } from "jotai";

export function RouteChangeListener() {
  const pathname = usePathname();
  const setOpenDrawer = useSetAtom(AppAtoms.drawerOpen);

  useEffect(() => {
    setOpenDrawer(false);
  }, [pathname]);

  return <></>;
}
