import { NextResponse } from "next/server";
import { getAuthDevReturnCode } from "@/lib/auth/auth-config";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { createLoginCode } from "@/lib/auth/sqlite-auth-repository";
import { logger } from "@/lib/logger";
import { getSmsProvider, getSmsProviderName } from "@/lib/sms/sms-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";

  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "请输入有效手机号。" }, { status: 400 });
  }

  const ttlMinutes = 5;

  try {
    const loginCode = createLoginCode(phone);
    await getSmsProvider().then((provider) =>
      provider.sendLoginCode({
        phone,
        code: loginCode.code,
        ttlMinutes,
      }),
    );
    await logger.info("登录验证码已发送", {
      provider: getSmsProviderName(),
      identityMasked: `${phone.slice(0, 3)}****${phone.slice(-4)}`,
      expiresAt: loginCode.expiresAt,
    });
    return NextResponse.json({
      ok: true,
      expiresAt: loginCode.expiresAt,
      devCode:
        process.env.NODE_ENV !== "production" &&
        (getSmsProviderName() === "dev" || getAuthDevReturnCode())
          ? loginCode.code
          : undefined,
    });
  } catch (error) {
    await logger.error("登录验证码发送失败", {
      provider: getSmsProviderName(),
      identityMasked: `${phone.slice(0, 3)}****${phone.slice(-4)}`,
      error,
    });
    const message = error instanceof Error ? error.message : "验证码发送失败，请稍后再试。";
    return NextResponse.json(
      { error: message },
      { status: message.includes("频繁") ? 429 : 502 },
    );
  }
}
