import { NextResponse } from "next/server";
import {
  buildWechatAuthorizeUrl,
  createWechatOAuthState,
  isWechatOAuthConfigured,
  sanitizeNextPath,
  wechatOAuthNextCookieName,
  wechatOAuthStateCookieName,
} from "@/lib/auth/wechat-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isWechatOAuthConfigured()) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "error",
      "微信登录尚未配置，请先设置 AUTH_WECHAT_APP_ID 和 AUTH_WECHAT_APP_SECRET。",
    );
    return NextResponse.redirect(loginUrl);
  }

  const { searchParams } = new URL(request.url);
  const state = createWechatOAuthState();
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const response = NextResponse.redirect(
    buildWechatAuthorizeUrl({
      requestUrl: request.url,
      state,
    }),
  );

  response.cookies.set(wechatOAuthStateCookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  response.cookies.set(wechatOAuthNextCookieName, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
