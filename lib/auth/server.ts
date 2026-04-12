import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookieName, createAuthToken, verifyAuthToken } from "@/lib/auth/jwt";
import { findUserById } from "@/lib/auth/sqlite-auth-repository";
import type { AuthSession, AuthUser } from "@/lib/auth/types";

export type AuthContext = {
  session: AuthSession;
  user: AuthUser;
};

export function createUnauthorizedResponse() {
  return NextResponse.json({ error: "请先登录。" }, { status: 401 });
}

export async function getSessionFromRequest(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${authCookieName}=`))
    ?.slice(authCookieName.length + 1);

  return token ? verifyAuthToken(decodeURIComponent(token)) : null;
}

export async function getCurrentAuthFromCookies(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  if (!session) {
    return null;
  }

  const user = findUserById(session.userId);
  return user ? { session, user } : null;
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const user = findUserById(session.userId);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return { session, user };
}

export async function setAuthCookie(response: NextResponse, session: AuthSession) {
  response.cookies.set(authCookieName, await createAuthToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
