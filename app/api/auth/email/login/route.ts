import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth/email";
import { isAdminEmail } from "@/lib/auth/admin-config";
import { normalizeInviteCode } from "@/lib/auth/invite-code";
import { createPendingSignupToken } from "@/lib/auth/jwt";
import {
  consumeEmailLoginCode,
  findUserByEmail,
  getOrCreateUserByEmailWithInvite,
} from "@/lib/auth/sqlite-auth-repository";
import { setAuthCookie } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
    inviteCode?: string;
    adminLogin?: boolean;
  };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const inviteCode =
    typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  const adminLogin = Boolean(body.adminLogin);

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "邮箱或验证码格式不正确。" }, { status: 400 });
  }

  if (!consumeEmailLoginCode(email, code)) {
    return NextResponse.json({ error: "验证码错误或已过期。" }, { status: 401 });
  }

  const existingUser = findUserByEmail(email);
  if (!existingUser && !adminLogin && !isAdminEmail(email)) {
    const normalizedInviteCode = normalizeInviteCode(inviteCode);
    if (normalizedInviteCode) {
      try {
        const { user } = getOrCreateUserByEmailWithInvite(email, normalizedInviteCode);
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
      } catch (error) {
        const inviteError = error instanceof Error ? error.message : "邀请码校验失败。";
        return NextResponse.json({
          requiresInvite: true,
          inviteError,
          pendingSignupToken: await createPendingSignupToken({
            email,
            identityType: "email",
            adminLogin: false,
          }),
        });
      }
    }

    return NextResponse.json({
      requiresInvite: true,
      pendingSignupToken: await createPendingSignupToken({
        email,
        identityType: "email",
        adminLogin: false,
      }),
    });
  }

  let user;
  try {
    if (adminLogin && !isAdminEmail(email)) {
      return NextResponse.json({ error: "此用户不是管理员" }, { status: 403 });
    }

    ({ user } = getOrCreateUserByEmailWithInvite(email, inviteCode));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "登录失败，请稍后再试。";
    return NextResponse.json(
      { error: message },
      {
        status: message.includes("邀请码") ? 403 : 500,
      },
    );
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
