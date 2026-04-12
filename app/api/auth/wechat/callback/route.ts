import { NextResponse } from "next/server";
import { getOrCreateUserByWechat } from "@/lib/auth/sqlite-auth-repository";
import { setAuthCookie } from "@/lib/auth/server";
import {
  exchangeWechatCodeForProfile,
  sanitizeNextPath,
  wechatOAuthNextCookieName,
  wechatOAuthStateCookieName,
} from "@/lib/auth/wechat-oauth";
import { logger } from "@/lib/logger";
import { claimUnownedReports } from "@/lib/report-store";

export const runtime = "nodejs";

function redirectToLogin(requestUrl: string, message: string) {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.searchParams.set("error", message);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookie
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
  const expectedState = cookies[wechatOAuthStateCookieName];
  const nextPath = sanitizeNextPath(cookies[wechatOAuthNextCookieName]);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToLogin(request.url, "微信登录状态已失效，请重试。");
  }

  try {
    const profile = await exchangeWechatCodeForProfile(code);
    const { user } = getOrCreateUserByWechat(profile);
    await claimUnownedReports(user.id);

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    await setAuthCookie(response, {
      userId: user.id,
      username: user.username,
      identityType: user.identityType,
      identityMasked: user.identityMasked,
    });
    response.cookies.set(wechatOAuthStateCookieName, "", { path: "/", maxAge: 0 });
    response.cookies.set(wechatOAuthNextCookieName, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    await logger.error("微信登录失败", { error });
    return redirectToLogin(request.url, "微信登录失败，请稍后再试。");
  }
}
