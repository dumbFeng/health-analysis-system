import { enqueueReportAnalysis } from "@/lib/ai/health-report-analyzer";
import { logger } from "@/lib/logger";
import { listReportIdsByStatus } from "@/lib/report-store";

let recoveryPromise: Promise<void> | null = null;

export async function ensureReportAnalysisRecovery() {
  if (!recoveryPromise) {
    recoveryPromise = recoverInterruptedReportAnalyses();
  }

  return recoveryPromise;
}

async function recoverInterruptedReportAnalyses() {
  try {
    const interruptedReportIds = await listReportIdsByStatus("analyzing");

    if (interruptedReportIds.length === 0) {
      await logger.debug("未发现需要恢复的报告分析任务", {});
      return;
    }

    await logger.warn("发现未完成的报告分析任务，准备重新入队", {
      count: interruptedReportIds.length,
      reportIds: interruptedReportIds,
    });

    for (const reportId of interruptedReportIds) {
      enqueueReportAnalysis(reportId);
    }
  } catch (error) {
    await logger.error("恢复报告分析任务失败", { error });
  }
}
