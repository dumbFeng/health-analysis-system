import { normalizeHealthReportAnalysis } from "@/lib/report-analysis-normalizer";
import { createHealthReportAiProviders } from "@/lib/ai/ai-provider-factory";
import { logger } from "@/lib/logger";
import { analysisQueue } from "@/lib/queue/report-queues";
import { getReport, updateReport } from "@/lib/report-store";

export async function analyzeStoredReport(reportId: string) {
  const report = await getReport(reportId);
  await logger.info("开始分析报告", {
    reportId,
    fileName: report.fileName,
  });

  await updateReport(reportId, (current) => ({
    ...current,
    status: "analyzing",
    errorMessage: null,
  }));

  try {
    const providers = createHealthReportAiProviders();
    await logger.info("已加载 AI provider 链", {
      reportId,
      providers: providers.map((provider) => ({
        provider: provider.providerName,
        model: provider.modelName,
      })),
    });
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        await logger.info("尝试使用 provider 分析报告", {
          reportId,
          provider: provider.providerName,
          model: provider.modelName,
        });
        const analysis = normalizeHealthReportAnalysis(
          await provider.analyzeHealthReport({ report }),
        );

        await updateReport(reportId, (current) => ({
          ...current,
          status: "succeeded",
          patientName: analysis.patient.name || null,
          examDate: analysis.reportMeta.examDate || null,
          institution: analysis.reportMeta.institution || null,
          summary: analysis.executiveSummary.summary || null,
          analysis: {
            ...analysis,
            model: provider.modelName,
          },
          errorMessage: null,
        }));

        await logger.info("报告分析成功", {
          reportId,
          provider: provider.providerName,
          model: provider.modelName,
          patientName: analysis.patient.name,
          overallRiskLevel: analysis.executiveSummary.overallRiskLevel,
        });

        return;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("报告分析失败，请稍后重试。");
        await logger.warn("provider 分析失败，准备尝试下一个兜底模型", {
          reportId,
          provider: provider.providerName,
          model: provider.modelName,
          error: lastError,
        });
      }
    }

    throw lastError ?? new Error("没有可用的 AI Provider。");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "报告分析失败，请稍后重试。";

    await updateReport(reportId, (current) => ({
      ...current,
      status: "failed",
      errorMessage: message,
      analysis: null,
    }));
    await logger.error("报告分析最终失败", {
      reportId,
      fileName: report.fileName,
      error,
    });
  }
}

export function enqueueReportAnalysis(reportId: string) {
  if (analysisQueue.isFull()) {
    void logger.error("报告分析任务入队失败：分析队列已满", {
      reportId,
      queue: analysisQueue.getStats(),
    });
    void updateReport(reportId, (current) => ({
      ...current,
      status: "failed",
      errorMessage: "分析任务繁忙，请稍后重试。",
      analysis: null,
    }));
    return;
  }

  void logger.info("报告分析任务已入队", {
    reportId,
    queue: analysisQueue.getStats(),
  });

  void analysisQueue.enqueue(`analyze:${reportId}`, async () => {
    await logger.info("报告分析任务开始执行", {
      reportId,
      queue: analysisQueue.getStats(),
    });
    await analyzeStoredReport(reportId);
  });
}
