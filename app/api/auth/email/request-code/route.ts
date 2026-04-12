import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth/email";
import { createEmailLoginCode } from "@/lib/auth/sqlite-auth-repository";
import {
  getEmailProvider,
  getEmailProviderName,
} from "@/lib/email/email-provider";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "请输入有效邮箱地址" }, { status: 400 });
  }

  const ttlMinutes = 5;

  try {
    const loginCode = createEmailLoginCode(email);
    await getEmailProvider().sendLoginCode({
      email,
      code: loginCode.code,
      ttlMinutes,
    });
    await logger.info("邮箱登录验证码已发送", {
      provider: getEmailProviderName(),
      expiresAt: loginCode.expiresAt,
    });
    return NextResponse.json({
      ok: true,
      expiresAt: loginCode.expiresAt,
      devCode:
        process.env.NODE_ENV !== "production" &&
        (getEmailProviderName() === "dev" ||
          process.env.AUTH_DEV_RETURN_CODE === "true")
          ? loginCode.code
          : undefined,
    });
  } catch (error) {
    await logger.error("邮箱登录验证码发送失败", {
      provider: getEmailProviderName(),
      error,
    });
    const message =
      error instanceof Error ? error.message : "验证码发送失败，请稍后再试。";
    return NextResponse.json(
      { error: message },
      { status: message.includes("频繁") ? 429 : 502 },
    );
  }
}
