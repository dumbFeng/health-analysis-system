"use client";

import { useEffect, useState } from "react";
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
  const [resolvedUser, setResolvedUser] = useState(currentUser);

  useEffect(() => {
    setResolvedUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname === "/login" || resolvedUser) {
      return;
    }

    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        const data = (await response.json()) as {
          user?: { username?: string };
        };
        return data.user?.username ? data.user : null;
      })
      .then((user) => {
        if (cancelled || !user) {
          return;
        }
        setResolvedUser({
          username: user.username || "",
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname, resolvedUser]);

  if (!resolvedUser || pathname.startsWith("/admin")) {
    return null;
  }

  return <AppTopNav currentUser={resolvedUser} />;
}
