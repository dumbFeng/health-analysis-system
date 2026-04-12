import { randomBytes } from "node:crypto";

export const wechatOAuthStateCookieName = "health_wechat_oauth_state";
export const wechatOAuthNextCookieName = "health_wechat_oauth_next";

type WechatAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUserInfoResponse = {
  openid?: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  privilege?: string[];
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`微信登录配置缺失: ${name}`);
  }

  return value;
}

export function isWechatOAuthConfigured() {
  return Boolean(process.env.WECHAT_OAUTH_APP_ID && process.env.WECHAT_OAUTH_APP_SECRET);
}

export function createWechatOAuthState() {
  return randomBytes(18).toString("base64url");
}

export function sanitizeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export function buildWechatAuthorizeUrl(input: {
  requestUrl: string;
  state: string;
}) {
  const appId = requireEnv("WECHAT_OAUTH_APP_ID");
  const redirectUri =
    process.env.WECHAT_OAUTH_REDIRECT_URI ||
    new URL("/api/auth/wechat/callback", input.requestUrl).toString();
  const url = new URL("https://open.weixin.qq.com/connect/qrconnect");
  url.searchParams.set("appid", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", process.env.WECHAT_OAUTH_SCOPE || "snsapi_login");
  url.searchParams.set("state", input.state);
  return `${url.toString()}#wechat_redirect`;
}

export async function exchangeWechatCodeForProfile(code: string) {
  const appId = requireEnv("WECHAT_OAUTH_APP_ID");
  const appSecret = requireEnv("WECHAT_OAUTH_APP_SECRET");
  const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  tokenUrl.searchParams.set("appid", appId);
  tokenUrl.searchParams.set("secret", appSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("grant_type", "authorization_code");

  const tokenResponse = (await fetch(tokenUrl, { cache: "no-store" }).then((response) =>
    response.json(),
  )) as WechatAccessTokenResponse;

  if (tokenResponse.errcode || !tokenResponse.access_token || !tokenResponse.openid) {
    throw new Error(tokenResponse.errmsg || "微信授权失败，无法获取 access_token");
  }

  const userInfoUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
  userInfoUrl.searchParams.set("access_token", tokenResponse.access_token);
  userInfoUrl.searchParams.set("openid", tokenResponse.openid);
  userInfoUrl.searchParams.set("lang", "zh_CN");

  const userInfo = (await fetch(userInfoUrl, { cache: "no-store" }).then((response) =>
    response.json(),
  )) as WechatUserInfoResponse;

  if (userInfo.errcode || !userInfo.openid) {
    throw new Error(userInfo.errmsg || "微信授权失败，无法获取用户信息");
  }

  return {
    openid: userInfo.openid,
    unionid: userInfo.unionid || tokenResponse.unionid,
    nickname: userInfo.nickname,
    headimgurl: userInfo.headimgurl,
  };
}
