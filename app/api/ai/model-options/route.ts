import { NextResponse } from "next/server";
import { createUnauthorizedResponse, requireAuth } from "@/lib/auth/server";
import { getRankedAiModelOptionsFromMemory } from "@/lib/ai/ai-provider-health-registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request).catch(() => null);
  if (!auth) {
    return createUnauthorizedResponse();
  }
  void auth;

  const ranked = getRankedAiModelOptionsFromMemory();
  return NextResponse.json({
    modelOptions: ranked.map((item) => ({
      id: item.id,
      provider: item.provider,
      model: item.model,
      label: item.label,
    })),
  });
}
