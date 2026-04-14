import type { AiHealthCheckResult } from "@/lib/ai/ai-provider";
import { getPrimaryAiHealthStatus } from "@/lib/ai/ai-provider-health-registry";

export async function getAiHealthStatus(): Promise<AiHealthCheckResult> {
  return getPrimaryAiHealthStatus();
}
