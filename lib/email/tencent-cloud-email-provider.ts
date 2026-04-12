import { createHash, createHmac } from "node:crypto";
import type { EmailProvider, SendLoginCodeEmailInput } from "@/lib/email/email-provider";

type TencentEmailResponse = {
  Response?: {
    Error?: {
      Code?: string;
      Message?: string;
    };
    MessageId?: string;
    RequestId?: string;
  };
};

const service = "ses";
const action = "SendEmail";
const version = "2020-10-02";
const algorithm = "TC3-HMAC-SHA256";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`邮件配置缺失: ${name}`);
  }

  return value;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacSha256Hex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function formatUtcDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function createAuthorization(input: {
  payload: string;
  host: string;
  secretId: string;
  secretKey: string;
  timestamp: number;
}) {
  const date = formatUtcDate(input.timestamp);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${input.host}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(input.payload),
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    String(input.timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const secretDate = hmacSha256(`TC3${input.secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = hmacSha256Hex(secretSigning, stringToSign);

  return `${algorithm} Credential=${input.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function buildTemplateData(input: SendLoginCodeEmailInput) {
  const values: Record<string, string> = {
    code: input.code,
    ttlMinutes: String(input.ttlMinutes),
  };
  const keys = (process.env.TENCENT_EMAIL_TEMPLATE_PARAMS || "code,ttlMinutes")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return Object.fromEntries(keys.map((key) => [key, values[key] ?? key]));
}

export class TencentCloudEmailProvider implements EmailProvider {
  async sendLoginCode(input: SendLoginCodeEmailInput) {
    const secretId = requireEnv("TENCENTCLOUD_SECRET_ID");
    const secretKey = requireEnv("TENCENTCLOUD_SECRET_KEY");
    const from = requireEnv("EMAIL_FROM");
    const templateId = Number(requireEnv("TENCENT_EMAIL_TEMPLATE_ID"));
    if (!Number.isFinite(templateId) || templateId <= 0) {
      throw new Error("邮件配置错误: TENCENT_EMAIL_TEMPLATE_ID 必须是有效数字");
    }

    const subject = process.env.TENCENT_EMAIL_SUBJECT || "【知几 CareYou】登录验证码";
    const replyTo = process.env.TENCENT_EMAIL_REPLY_TO || "";
    const region = process.env.TENCENT_EMAIL_REGION || "ap-guangzhou";
    const host = process.env.TENCENT_EMAIL_ENDPOINT || "ses.tencentcloudapi.com";
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      FromEmailAddress: from,
      Destination: [input.email],
      Subject: subject,
      Template: {
        TemplateID: templateId,
        TemplateData: JSON.stringify(buildTemplateData(input)),
      },
      TriggerType: 1,
      ...(replyTo ? { ReplyToAddresses: replyTo } : {}),
    });
    const authorization = createAuthorization({
      payload,
      host,
      secretId,
      secretKey,
      timestamp,
    });

    const response = await fetch(`https://${host}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        Host: host,
        "X-TC-Action": action,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Version": version,
        "X-TC-Region": region,
      },
      body: payload,
    });
    const data = (await response.json().catch(() => ({}))) as TencentEmailResponse;

    if (!response.ok || data.Response?.Error) {
      const error = data.Response?.Error;
      throw new Error(error?.Message || error?.Code || "腾讯云邮件发送失败");
    }
  }
}
