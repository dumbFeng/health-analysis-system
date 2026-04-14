import { NextResponse } from "next/server";
import { createForbiddenResponse, createUnauthorizedResponse, requireAdmin } from "@/lib/auth/server";
import {
  createInviteCodeRecord,
  listInviteCodeRecords,
} from "@/lib/auth/sqlite-auth-repository";
import { buildAppUrlFromRequestUrl } from "@/lib/app-base-url";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function buildInviteLink(request: Request, inviteCode: string) {
  const url = new URL("/login", buildAppUrlFromRequestUrl(request.url));
  url.searchParams.set("inviteCode", inviteCode);
  return url.toString();
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({
      invitations: listInviteCodeRecords(50).map((item) => ({
        ...item,
        inviteLink: buildInviteLink(request, item.code),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return createUnauthorizedResponse();
    }

    return createForbiddenResponse();
  }
}

export async function POST(request: Request) {
  let auth;
  try {
    auth = await requireAdmin(request);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return createUnauthorizedResponse();
    }

    return createForbiddenResponse();
  }

  const body = (await request.json().catch(() => ({}))) as {
    maxUses?: number;
    expiresInDays?: number;
  };
  const maxUses = Number(body.maxUses);
  const expiresInDays = Number(body.expiresInDays);

  if (!Number.isFinite(maxUses) || maxUses <= 0) {
    return NextResponse.json({ error: "邀请码可用次数必须大于 0。" }, { status: 400 });
  }

  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
    return NextResponse.json({ error: "邀请码有效期必须大于 0 天。" }, { status: 400 });
  }

  try {
    const invitation = createInviteCodeRecord({
      createdByUserId: auth.user.id,
      maxUses,
      expiresInMs: Math.floor(expiresInDays * 24 * 60 * 60 * 1000),
    });
    return NextResponse.json({
      invitation: {
        ...invitation,
        inviteLink: buildInviteLink(request, invitation.code),
      },
    });
  } catch (error) {
    await logger.error("生成邀请码失败", {
      adminUserId: auth.user.id,
      error,
    });
    return NextResponse.json({ error: "邀请码生成失败，请稍后再试。" }, { status: 500 });
  }
}
