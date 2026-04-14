import { getAvailableAiModelOptions } from "@/lib/ai/ai-model-options";

export type ModelMonitorItem = {
  id: string;
  provider: string;
  model: string;
  label: string;
  consecutiveFailures: number;
  lastError: string | null;
  lastReportId: string | null;
  updatedAt: string | null;
};

type RuntimeModelStats = {
  consecutiveFailures: number;
  lastError: string | null;
  lastReportId: string | null;
  updatedAt: string;
};

const statsByModelKey = new Map<string, RuntimeModelStats>();

function getModelKey(provider: string, model: string) {
  return `${provider.toLowerCase()}:${model}`;
}

export function markModelAnalysisSuccess(input: {
  provider: string;
  model: string;
  reportId: string;
}) {
  statsByModelKey.set(getModelKey(input.provider, input.model), {
    consecutiveFailures: 0,
    lastError: null,
    lastReportId: input.reportId,
    updatedAt: new Date().toISOString(),
  });
}

export function markModelAnalysisFailure(input: {
  provider: string;
  model: string;
  reportId: string;
  error: unknown;
}) {
  const key = getModelKey(input.provider, input.model);
  const previous = statsByModelKey.get(key);
  const message =
    input.error instanceof Error
      ? input.error.message
      : typeof input.error === "string"
        ? input.error
        : "未知错误";

  statsByModelKey.set(key, {
    consecutiveFailures: (previous?.consecutiveFailures || 0) + 1,
    lastError: message,
    lastReportId: input.reportId,
    updatedAt: new Date().toISOString(),
  });
}

export function getModelMonitorItemsFromMemory(): ModelMonitorItem[] {
  return getAvailableAiModelOptions().map((option) => {
    const stats = statsByModelKey.get(getModelKey(option.provider, option.model));
    return {
      id: option.id,
      provider: option.provider,
      model: option.model,
      label: option.label,
      consecutiveFailures: stats?.consecutiveFailures || 0,
      lastError: stats?.lastError || null,
      lastReportId: stats?.lastReportId || null,
      updatedAt: stats?.updatedAt || null,
    };
  });
}
