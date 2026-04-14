import { headers } from "next/headers";
import { InvitationManager } from "@/components/admin/invitation-manager";
import { listInviteCodeRecords } from "@/lib/auth/sqlite-auth-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminInvitationsPage() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  return (
    <InvitationManager
      initialInvitations={listInviteCodeRecords(50).map((item) => ({
        ...item,
        inviteLink: `${baseUrl}/login?inviteCode=${encodeURIComponent(item.code)}`,
      }))}
    />
  );
}
