import { TaskQueue } from "@/lib/queue/task-queue";

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const uploadConcurrency = readPositiveInt(
  process.env.REPORT_UPLOAD_QUEUE_CONCURRENCY,
  1,
);
const uploadCap = readPositiveInt(process.env.REPORT_UPLOAD_QUEUE_CAP, 20);
const analysisConcurrency = readPositiveInt(
  process.env.REPORT_ANALYSIS_QUEUE_CONCURRENCY,
  2,
);
const analysisCap = readPositiveInt(process.env.REPORT_ANALYSIS_QUEUE_CAP, 200);

export const uploadQueue = new TaskQueue(
  "report-upload",
  uploadConcurrency,
  uploadCap,
);

const analysisQueuesByProvider = new Map<string, TaskQueue>();

function normalizeProviderQueueKey(provider: string | null | undefined) {
  const normalized = (provider || "default").trim().toLowerCase();
  return normalized || "default";
}

export function getAnalysisQueueByProvider(provider: string | null | undefined) {
  const key = normalizeProviderQueueKey(provider);
  const existing = analysisQueuesByProvider.get(key);
  if (existing) {
    return existing;
  }

  const created = new TaskQueue(
    `report-analysis:${key}`,
    analysisConcurrency,
    analysisCap,
  );
  analysisQueuesByProvider.set(key, created);
  return created;
}

export function getAllAnalysisQueueStats() {
  return Array.from(analysisQueuesByProvider.entries()).map(([provider, queue]) => ({
    provider,
    ...queue.getStats(),
  }));
}
