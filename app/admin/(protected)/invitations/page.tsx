import { InvitationManager } from "@/components/admin/invitation-manager";
import { getAppBaseUrlFromHeaders } from "@/lib/app-base-url";
import { listInviteCodeRecords } from "@/lib/auth/sqlite-auth-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminInvitationsPage() {
  const baseUrl = await getAppBaseUrlFromHeaders();

  return (
    <InvitationManager
      initialInvitations={listInviteCodeRecords(50).map((item) => ({
        ...item,
        inviteLink: `${baseUrl}/login?inviteCode=${encodeURIComponent(item.code)}`,
      }))}
    />
  );
}
