import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentAuthFromCookies } from "@/lib/auth/server";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; inviteCode?: string }>;
}) {
  const auth = await getCurrentAuthFromCookies();
  const { next, error, inviteCode } = await searchParams;
  const nextPath = sanitizeNextPath(next);

  if (auth) {
    redirect(isAdminUser(auth.user) ? nextPath : "/");
  }

  return (
    <LoginForm
      nextPath={nextPath}
      initialMessage={error}
      initialInviteCode={typeof inviteCode === "string" ? inviteCode : ""}
      mode="admin"
    />
  );
}
