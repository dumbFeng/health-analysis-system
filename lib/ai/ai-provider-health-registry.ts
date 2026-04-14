import type { AiHealthCheckResult } from "@/lib/ai/ai-provider";
import { getAvailableAiModelOptions, type AiModelOption } from "@/lib/ai/ai-model-options";

export type RankedAiModelOption = AiModelOption;

export function ensureAiProviderHealthRegistryStarted() {
  // 探活逻辑已移除，保留空函数以兼容旧调用点。
}

export function getHealthyAiModelOptionsFromMemory() {
  return getAvailableAiModelOptions();
}

export function getRankedAiModelOptionsFromMemory(): RankedAiModelOption[] {
  return getAvailableAiModelOptions();
}

export async function getHealthyAiModelOptions() {
  return getAvailableAiModelOptions();
}

export async function findHealthyAiModelOptionById(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return getAvailableAiModelOptions().find((item) => item.id === id) || null;
}

export async function getPrimaryAiHealthStatus(): Promise<AiHealthCheckResult> {
  const [first] = getAvailableAiModelOptions();
  if (!first) {
    return {
      status: "invalid",
      providerName: "unknown",
      modelName: "",
      configured: false,
      live: false,
      checkedAt: new Date().toISOString(),
      issues: ["未配置任何 AI Provider。"],
      warnings: [],
      message: "未配置任何 AI Provider。",
    };
  }

  return {
    status: "healthy",
    providerName: first.provider,
    modelName: first.model,
    configured: true,
    live: true,
    checkedAt: new Date().toISOString(),
    issues: [],
    warnings: [],
    message: "已配置 AI Provider。",
  };
}
