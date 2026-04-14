import { createHash, createHmac } from "node:crypto";
import {
  getAuthSmsEndpoint,
  getAuthSmsRegion,
  getAuthSmsSdkAppId,
  getAuthSmsSignName,
  getAuthSmsTemplateId,
  getAuthSmsTemplateParams,
  getAuthTencentSecretId,
  getAuthTencentSecretKey,
} from "@/lib/auth/auth-config";
import type { SendLoginCodeSmsInput, SmsProvider } from "@/lib/sms/sms-provider";

type TencentSmsResponse = {
  Response?: {
    Error?: {
      Code?: string;
      Message?: string;
    };
    SendStatusSet?: Array<{
      Code?: string;
      Message?: string;
      PhoneNumber?: string;
    }>;
    RequestId?: string;
  };
};

const service = "sms";
const action = "SendSms";
const version = "2021-01-11";
const algorithm = "TC3-HMAC-SHA256";

function requireEnv(name: string) {
  let value = "";
  if (name === "AUTH_TENCENT_SECRET_ID") {
    value = getAuthTencentSecretId();
  } else if (name === "AUTH_TENCENT_SECRET_KEY") {
    value = getAuthTencentSecretKey();
  } else if (name === "AUTH_SMS_TENCENT_SDK_APP_ID") {
    value = getAuthSmsSdkAppId();
  } else if (name === "AUTH_SMS_TENCENT_SIGN_NAME") {
    value = getAuthSmsSignName();
  } else if (name === "AUTH_SMS_TENCENT_TEMPLATE_ID") {
    value = getAuthSmsTemplateId();
  }
  if (!value) {
    throw new Error(`短信配置缺失: ${name}`);
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

function normalizeTencentPhone(phone: string) {
  const normalized = phone.replace(/[\s-]/g, "").trim();
  if (normalized.startsWith("+")) {
    return normalized;
  }

  if (/^1\d{10}$/.test(normalized)) {
    return `+86${normalized}`;
  }

  return normalized;
}

function buildTemplateParamSet(input: SendLoginCodeSmsInput) {
  const order = getAuthSmsTemplateParams()
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return order.map((item) => {
    if (item === "code") {
      return input.code;
    }
    if (item === "ttlMinutes") {
      return String(input.ttlMinutes);
    }

    return item;
  });
}

function createAuthorization(input: {
  payload: string;
  host: string;
  region: string;
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

export class TencentCloudSmsProvider implements SmsProvider {
  async sendLoginCode(input: SendLoginCodeSmsInput) {
    const secretId = requireEnv("AUTH_TENCENT_SECRET_ID");
    const secretKey = requireEnv("AUTH_TENCENT_SECRET_KEY");
    const smsSdkAppId = requireEnv("AUTH_SMS_TENCENT_SDK_APP_ID");
    const signName = requireEnv("AUTH_SMS_TENCENT_SIGN_NAME");
    const templateId = requireEnv("AUTH_SMS_TENCENT_TEMPLATE_ID");
    const region = getAuthSmsRegion();
    const host = getAuthSmsEndpoint();
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      PhoneNumberSet: [normalizeTencentPhone(input.phone)],
      SmsSdkAppId: smsSdkAppId,
      SignName: signName,
      TemplateId: templateId,
      TemplateParamSet: buildTemplateParamSet(input),
    });
    const authorization = createAuthorization({
      payload,
      host,
      region,
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
    const data = (await response.json().catch(() => ({}))) as TencentSmsResponse;

    if (!response.ok || data.Response?.Error) {
      const error = data.Response?.Error;
      throw new Error(error?.Message || error?.Code || "腾讯云短信发送失败");
    }

    const failedStatus = data.Response?.SendStatusSet?.find((item) => item.Code !== "Ok");
    if (failedStatus) {
      throw new Error(failedStatus.Message || failedStatus.Code || "腾讯云短信发送失败");
    }
  }
}
