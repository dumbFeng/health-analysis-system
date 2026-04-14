import { headers } from "next/headers";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/g, "");
}

export function getConfiguredAppBaseUrl() {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.AUTH_APP_BASE_URL ||
    "";

  return configured ? normalizeBaseUrl(configured) : "";
}

export function buildAppUrlFromRequestUrl(requestUrl: string) {
  const configured = getConfiguredAppBaseUrl();
  if (configured) {
    return configured;
  }

  return normalizeBaseUrl(new URL("/", requestUrl).toString());
}

export async function getAppBaseUrlFromHeaders() {
  const configured = getConfiguredAppBaseUrl();
  if (configured) {
    return configured;
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  return normalizeBaseUrl(`${protocol}://${host}`);
}
