import { NextResponse } from "next/server";
import { createUnauthorizedResponse, requireAuth } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    return NextResponse.json({
      user: {
        id: auth.user.id,
        identityType: auth.user.identityType,
        identityMasked: auth.user.identityMasked,
        username: auth.user.username,
      },
    });
  } catch {
    return createUnauthorizedResponse();
  }
}
