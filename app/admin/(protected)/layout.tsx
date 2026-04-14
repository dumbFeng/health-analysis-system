import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getUserEmail, isAdminUser } from "@/lib/auth/admin";
import { getCurrentAuthFromCookies } from "@/lib/auth/server";
import { adminNavItems } from "@/lib/navigation/admin-nav-items";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getCurrentAuthFromCookies();
  if (!auth) {
    redirect("/admin/login");
  }

  if (!isAdminUser(auth.user)) {
    redirect("/admin/login?error=admin_required");
  }

  return (
    <AdminShell
      currentUser={{
        username: auth.user.username,
        email: getUserEmail(auth.user) || auth.user.identityMasked,
      }}
      navItems={adminNavItems}
    >
      {children}
    </AdminShell>
  );
}
