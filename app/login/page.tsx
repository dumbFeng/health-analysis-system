import { redirect } from "next/navigation";
import { getCurrentAuthFromCookies } from "@/lib/auth/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const auth = await getCurrentAuthFromCookies();
  const { next, error } = await searchParams;
  const nextPath = sanitizeNextPath(next);
  if (auth) {
    redirect(nextPath);
  }

  return <LoginForm nextPath={nextPath} initialMessage={error} />;
}
