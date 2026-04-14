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

function resolveLoginErrorMessage(error: string | undefined) {
  if (!error) {
    return "";
  }

  if (error === "admin_required") {
    return "请使用管理员账号登录";
  }

  return error;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; inviteCode?: string }>;
}) {
  const auth = await getCurrentAuthFromCookies();
  const { next, error, inviteCode } = await searchParams;
  const nextPath = sanitizeNextPath(next);
  const initialMessage = resolveLoginErrorMessage(error);

  if (auth) {
    if (isAdminUser(auth.user)) {
      redirect(nextPath);
    }
  }

  return (
    <LoginForm
      nextPath={nextPath}
      initialMessage={initialMessage}
      initialInviteCode={typeof inviteCode === "string" ? inviteCode : ""}
      mode="admin"
    />
  );
}
