import { enqueueReportAnalysis } from "@/lib/ai/health-report-analyzer";
import { logger } from "@/lib/logger";
import { listReports } from "@/lib/report-store";

let recoveryPromise: Promise<void> | null = null;

export async function ensureReportAnalysisRecovery() {
  if (!recoveryPromise) {
    recoveryPromise = recoverInterruptedReportAnalyses();
  }

  return recoveryPromise;
}

async function recoverInterruptedReportAnalyses() {
  try {
    const reports = await listReports();
    const interruptedReports = reports.filter(
      (report) => report.status === "analyzing",
    );

    if (interruptedReports.length === 0) {
      await logger.debug("未发现需要恢复的报告分析任务", {});
      return;
    }

    await logger.warn("发现未完成的报告分析任务，准备重新入队", {
      count: interruptedReports.length,
      reportIds: interruptedReports.map((report) => report.id),
    });

    for (const report of interruptedReports) {
      enqueueReportAnalysis(report.id);
    }
  } catch (error) {
    await logger.error("恢复报告分析任务失败", { error });
  }
}
