import { NextResponse } from "next/server";
import { getAiHealthStatus } from "@/lib/ai/ai-health";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  const health = await getAiHealthStatus();
  await logger.debug("AI 健康检查", {
    status: health.status,
    configured: health.configured,
    live: health.live,
  });

  return NextResponse.json(
    { health },
    {
      status:
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 206
            : 503,
    },
  );
}
