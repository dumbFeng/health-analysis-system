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

export const analysisQueue = new TaskQueue(
  "report-analysis",
  analysisConcurrency,
  analysisCap,
);
