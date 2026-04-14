import { NextResponse } from "next/server";
import { createPendingSignupToken, verifyPendingSignupToken } from "@/lib/auth/jwt";
import {
  createUserByEmailWithInvite,
  findUserByEmail,
} from "@/lib/auth/sqlite-auth-repository";
import { setAuthCookie } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    pendingSignupToken?: string;
    inviteCode?: string;
  };
  const pendingSignupToken =
    typeof body.pendingSignupToken === "string" ? body.pendingSignupToken.trim() : "";
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";

  if (!pendingSignupToken) {
    return NextResponse.json({ error: "注册状态已失效，请重新登录。" }, { status: 401 });
  }

  const pendingSignup = await verifyPendingSignupToken(pendingSignupToken);
  if (!pendingSignup || pendingSignup.adminLogin) {
    return NextResponse.json({ error: "注册状态已失效，请重新登录。" }, { status: 401 });
  }

  let user = findUserByEmail(pendingSignup.email);
  if (!user) {
    try {
      ({ user } = createUserByEmailWithInvite(pendingSignup.email, inviteCode));
    } catch (error) {
      const message = error instanceof Error ? error.message : "邀请码校验失败。";
      return NextResponse.json({ error: message }, { status: 403 });
    }
  }

  if (!user) {
    return NextResponse.json({ error: "账号创建失败，请稍后重试。" }, { status: 500 });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      identityType: user.identityType,
      identityMasked: user.identityMasked,
      username: user.username,
    },
  });

  await setAuthCookie(response, {
    userId: user.id,
    identityType: user.identityType,
    identityMasked: user.identityMasked,
    username: user.username,
  });

  return response;
}
