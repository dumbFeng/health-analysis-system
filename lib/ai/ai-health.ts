import type { AiHealthCheckResult } from "@/lib/ai/ai-provider";
import {
  createHealthReportAiProviders,
  getConfiguredAiProviderChain,
} from "@/lib/ai/ai-provider-factory";
import { logger } from "@/lib/logger";

export async function getAiHealthStatus(): Promise<AiHealthCheckResult> {
  try {
    const [primary] = createHealthReportAiProviders();

    if (!primary) {
      throw new Error("未配置任何 AI Provider。");
    }

    const result = await primary.healthCheck();
    await logger.debug("执行 AI 健康检查", {
      provider: result.providerName,
      model: result.modelName,
      status: result.status,
    });
    return result;
  } catch (error) {
    const [first] = getConfiguredAiProviderChain();
    await logger.error("AI 健康检查失败", {
      provider: first?.provider || "unknown",
      model: first?.model || "",
      error,
    });
    return {
      status: "invalid",
      providerName: first?.provider || "unknown",
      modelName: first?.model || "",
      configured: false,
      live: false,
      checkedAt: new Date().toISOString(),
      issues: [
        error instanceof Error ? error.message : "AI Provider 初始化失败。",
      ],
      warnings: [],
      message: "AI Provider 配置无效，无法完成初始化。",
    };
  }
}
