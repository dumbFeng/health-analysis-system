import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "健康体检风险看板",
  description: "基于体检结果的家庭健康风险分层与就诊建议展示系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
