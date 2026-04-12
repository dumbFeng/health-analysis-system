import { NextResponse, type NextRequest } from "next/server";
import { authCookieName, verifyAuthToken } from "@/lib/auth/jwt";

const publicPrefixes = [
  "/login",
  "/api/auth/request-code",
  "/api/auth/login",
  "/api/auth/email/request-code",
  "/api/auth/email/login",
  "/api/auth/logout",
  "/api/auth/wechat/start",
  "/api/auth/wechat/callback",
  "/_next",
  "/favicon.ico",
];

function isPublicPath(pathname: string) {
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(authCookieName)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
