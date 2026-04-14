"use client";

import { usePathname } from "next/navigation";
import { AppTopNav } from "@/components/app-top-nav";

type RootChromeProps = {
  currentUser: {
    username: string;
    avatarUrl?: string;
  } | null;
};

export function RootChrome({ currentUser }: RootChromeProps) {
  const pathname = usePathname();
  if (!currentUser || pathname.startsWith("/admin")) {
    return null;
  }

  return <AppTopNav currentUser={currentUser} />;
}
