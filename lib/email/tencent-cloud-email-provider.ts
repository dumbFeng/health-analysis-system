import { createHash, createHmac } from "node:crypto";
import {
  getAuthEmailFrom,
  getAuthEmailTencentEndpoint,
  getAuthEmailTencentRegion,
  getAuthEmailTencentReplyTo,
  getAuthEmailTencentSubject,
  getAuthEmailTencentTemplateId,
  getAuthEmailTencentTemplateParams,
  getAuthTencentSecretId,
  getAuthTencentSecretKey,
} from "@/lib/auth/auth-config";
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
  let value = "";
  if (name === "AUTH_TENCENT_SECRET_ID") {
    value = getAuthTencentSecretId();
  } else if (name === "AUTH_TENCENT_SECRET_KEY") {
    value = getAuthTencentSecretKey();
  } else if (name === "AUTH_EMAIL_FROM") {
    value = getAuthEmailFrom();
  } else if (name === "AUTH_EMAIL_TENCENT_TEMPLATE_ID") {
    value = getAuthEmailTencentTemplateId();
  }

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
  const keys = getAuthEmailTencentTemplateParams()
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return Object.fromEntries(keys.map((key) => [key, values[key] ?? key]));
}

export class TencentCloudEmailProvider implements EmailProvider {
  async sendLoginCode(input: SendLoginCodeEmailInput) {
    const secretId = requireEnv("AUTH_TENCENT_SECRET_ID");
    const secretKey = requireEnv("AUTH_TENCENT_SECRET_KEY");
    const from = requireEnv("AUTH_EMAIL_FROM");
    const templateId = Number(requireEnv("AUTH_EMAIL_TENCENT_TEMPLATE_ID"));
    if (!Number.isFinite(templateId) || templateId <= 0) {
      throw new Error("邮件配置错误: AUTH_EMAIL_TENCENT_TEMPLATE_ID 必须是有效数字");
    }

    const subject = getAuthEmailTencentSubject();
    const replyTo = getAuthEmailTencentReplyTo();
    const region = getAuthEmailTencentRegion();
    const host = getAuthEmailTencentEndpoint();
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
      const code = error?.Code ? ` code=${error.Code};` : "";
      const requestId = data.Response?.RequestId
        ? ` requestId=${data.Response.RequestId};`
        : "";
      const message = error?.Message || error?.Code || response.statusText || "腾讯云邮件发送失败";
      throw new Error(`${message}${code}${requestId}`.trim());
    }
  }
}
