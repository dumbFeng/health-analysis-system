import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth/email";
import {
  consumeEmailLoginCode,
  getOrCreateUserByEmail,
} from "@/lib/auth/sqlite-auth-repository";
import { setAuthCookie } from "@/lib/auth/server";
import { claimUnownedReports } from "@/lib/report-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
  };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "邮箱或验证码格式不正确。" }, { status: 400 });
  }

  if (!consumeEmailLoginCode(email, code)) {
    return NextResponse.json({ error: "验证码错误或已过期。" }, { status: 401 });
  }

  const { user } = getOrCreateUserByEmail(email);
  await claimUnownedReports(user.id);

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
