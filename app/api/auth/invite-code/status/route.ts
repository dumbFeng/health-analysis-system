import { NextResponse } from "next/server";
import { getInviteCodeStatus } from "@/lib/auth/sqlite-auth-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const status = getInviteCodeStatus(code);

  return NextResponse.json({
    inviteCode: {
      usable: status.usable,
      status: status.status,
      usedCount: status.usedCount,
      maxUses: status.maxUses,
      remainingUses: status.remainingUses,
      expiresAt: status.expiresAt,
    },
  });
}
