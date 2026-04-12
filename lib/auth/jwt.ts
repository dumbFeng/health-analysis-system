import type { AuthSession } from "@/lib/auth/types";

export const authCookieName = "health_auth_token";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

type JwtPayload = AuthSession & {
  iat: number;
  exp: number;
};

function getJwtSecret() {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_JWT_SECRET && !process.env.JWT_SECRET) {
    throw new Error("认证配置缺失: AUTH_JWT_SECRET");
  }

  return (
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "dev-only-health-analysis-jwt-secret-change-me"
  );
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getJwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(input: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createAuthToken(session: AuthSession) {
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = 60 * 60 * 24 * 30;
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const payload: JwtPayload = {
    ...session,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(signingInput);

  return `${signingInput}.${signature}`;
}

export async function verifyAuthToken(token: string): Promise<AuthSession | null> {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await sign(signingInput);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<JwtPayload>;
    if (
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000) ||
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      (payload.identityType !== "phone" &&
        payload.identityType !== "email" &&
        payload.identityType !== "wechat") ||
      typeof payload.identityMasked !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      identityType: payload.identityType,
      identityMasked: payload.identityMasked,
    };
  } catch {
    return null;
  }
}
