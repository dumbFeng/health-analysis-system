import type { Metadata } from "next";
import { AppTopNav } from "@/components/app-top-nav";
import { BackToTopButton } from "@/components/back-to-top-button";
import { getCurrentAuthFromCookies } from "@/lib/auth/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "知几 CareYou",
  description: "知几 CareYou，基于体检结果的家庭健康风险分层与就诊建议展示系统",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getCurrentAuthFromCookies();

  return (
    <html lang="zh-CN">
      <body>
        {auth ? (
          <AppTopNav
            currentUser={{
              username: auth.user.username,
              avatarUrl: auth.user.avatarUrl,
            }}
          />
        ) : null}
        {children}
        <BackToTopButton />
      </body>
    </html>
  );
}
