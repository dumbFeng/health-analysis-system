function getFirstNonEmptyEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function getBooleanEnv(keys: string[], fallback = false) {
  const value = getFirstNonEmptyEnv(keys);
  if (!value) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

export function getAuthDevReturnCode() {
  return getBooleanEnv(["AUTH_DEV_RETURN_CODE"], false);
}

export function getAuthTencentSecretId() {
  return getFirstNonEmptyEnv(["AUTH_TENCENT_SECRET_ID", "TENCENTCLOUD_SECRET_ID"]);
}

export function getAuthTencentSecretKey() {
  return getFirstNonEmptyEnv(["AUTH_TENCENT_SECRET_KEY", "TENCENTCLOUD_SECRET_KEY"]);
}

export function getAuthSmsProviderName() {
  return getFirstNonEmptyEnv(["AUTH_SMS_PROVIDER", "SMS_PROVIDER"]) || "dev";
}

export function getAuthSmsRegion() {
  return getFirstNonEmptyEnv(["AUTH_SMS_TENCENT_REGION", "TENCENT_SMS_REGION"]) || "ap-guangzhou";
}

export function getAuthSmsEndpoint() {
  return (
    getFirstNonEmptyEnv(["AUTH_SMS_TENCENT_ENDPOINT", "TENCENT_SMS_ENDPOINT"]) ||
    "sms.tencentcloudapi.com"
  );
}

export function getAuthSmsSdkAppId() {
  return getFirstNonEmptyEnv(["AUTH_SMS_TENCENT_SDK_APP_ID", "TENCENT_SMS_SDK_APP_ID"]);
}

export function getAuthSmsSignName() {
  return getFirstNonEmptyEnv(["AUTH_SMS_TENCENT_SIGN_NAME", "TENCENT_SMS_SIGN_NAME"]);
}

export function getAuthSmsTemplateId() {
  return getFirstNonEmptyEnv(["AUTH_SMS_TENCENT_TEMPLATE_ID", "TENCENT_SMS_TEMPLATE_ID"]);
}

export function getAuthSmsTemplateParams() {
  return (
    getFirstNonEmptyEnv(["AUTH_SMS_TENCENT_TEMPLATE_PARAMS", "TENCENT_SMS_TEMPLATE_PARAMS"]) ||
    "code"
  );
}

export function getAuthEmailProviderName() {
  return getFirstNonEmptyEnv(["AUTH_EMAIL_PROVIDER", "EMAIL_PROVIDER"]) || "dev";
}

export function getAuthEmailFrom() {
  return getFirstNonEmptyEnv(["AUTH_EMAIL_FROM", "EMAIL_FROM"]);
}

export function getAuthEmailResendApiKey() {
  return getFirstNonEmptyEnv(["AUTH_EMAIL_RESEND_API_KEY", "RESEND_API_KEY"]);
}

export function getAuthEmailTencentRegion() {
  return (
    getFirstNonEmptyEnv(["AUTH_EMAIL_TENCENT_REGION", "TENCENT_EMAIL_REGION"]) ||
    "ap-guangzhou"
  );
}

export function getAuthEmailTencentEndpoint() {
  return (
    getFirstNonEmptyEnv(["AUTH_EMAIL_TENCENT_ENDPOINT", "TENCENT_EMAIL_ENDPOINT"]) ||
    "ses.tencentcloudapi.com"
  );
}

export function getAuthEmailTencentTemplateId() {
  return getFirstNonEmptyEnv([
    "AUTH_EMAIL_TENCENT_TEMPLATE_ID",
    "TENCENT_EMAIL_TEMPLATE_ID",
  ]);
}

export function getAuthEmailTencentSubject() {
  return (
    getFirstNonEmptyEnv(["AUTH_EMAIL_TENCENT_SUBJECT", "TENCENT_EMAIL_SUBJECT"]) ||
    "【知几 CareYou】登录验证码"
  );
}

export function getAuthEmailTencentReplyTo() {
  return getFirstNonEmptyEnv(["AUTH_EMAIL_TENCENT_REPLY_TO", "TENCENT_EMAIL_REPLY_TO"]);
}

export function getAuthEmailTencentTemplateParams() {
  return (
    getFirstNonEmptyEnv([
      "AUTH_EMAIL_TENCENT_TEMPLATE_PARAMS",
      "TENCENT_EMAIL_TEMPLATE_PARAMS",
    ]) || "code,ttlMinutes"
  );
}

export function getAuthWechatAppId() {
  return getFirstNonEmptyEnv(["AUTH_WECHAT_APP_ID", "WECHAT_OAUTH_APP_ID"]);
}

export function getAuthWechatAppSecret() {
  return getFirstNonEmptyEnv(["AUTH_WECHAT_APP_SECRET", "WECHAT_OAUTH_APP_SECRET"]);
}

export function getAuthWechatRedirectUri() {
  return getFirstNonEmptyEnv([
    "AUTH_WECHAT_REDIRECT_URI",
    "WECHAT_OAUTH_REDIRECT_URI",
  ]);
}

export function getAuthWechatScope() {
  return getFirstNonEmptyEnv(["AUTH_WECHAT_SCOPE", "WECHAT_OAUTH_SCOPE"]) || "snsapi_login";
}
