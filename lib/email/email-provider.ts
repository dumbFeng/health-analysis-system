import { TencentCloudEmailProvider } from "@/lib/email/tencent-cloud-email-provider";

export type SendLoginCodeEmailInput = {
  email: string;
  code: string;
  ttlMinutes: number;
};

export type EmailProvider = {
  sendLoginCode(input: SendLoginCodeEmailInput): Promise<void>;
};

class DevEmailProvider implements EmailProvider {
  async sendLoginCode() {
    return;
  }
}

class ResendEmailProvider implements EmailProvider {
  async sendLoginCode(input: SendLoginCodeEmailInput) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error("邮件配置缺失: RESEND_API_KEY 或 EMAIL_FROM");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.email,
        subject: "健康分析系统登录验证码",
        text: `你的登录验证码是 ${input.code}，${input.ttlMinutes} 分钟内有效。`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || "邮件发送失败");
    }
  }
}

export function getEmailProviderName() {
  return (process.env.EMAIL_PROVIDER || "dev").trim().toLowerCase();
}

export function getEmailProvider(): EmailProvider {
  const provider = getEmailProviderName();
  if (provider === "tencent") {
    return new TencentCloudEmailProvider();
  }

  if (provider === "resend") {
    return new ResendEmailProvider();
  }

  return new DevEmailProvider();
}
