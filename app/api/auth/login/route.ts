import { NextResponse } from "next/server";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import {
  consumeLoginCode,
  getOrCreateUserByPhone,
} from "@/lib/auth/sqlite-auth-repository";
import { setAuthCookie } from "@/lib/auth/server";
import { claimUnownedReports } from "@/lib/report-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    code?: string;
  };
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!isValidPhone(phone) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "手机号或验证码格式不正确。" }, { status: 400 });
  }

  if (!consumeLoginCode(phone, code)) {
    return NextResponse.json({ error: "验证码错误或已过期。" }, { status: 401 });
  }

  const { user } = getOrCreateUserByPhone(phone);
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
