import { normalizeHealthReportAnalysis } from "@/lib/report-analysis-normalizer";
import { createHealthReportAiProviders } from "@/lib/ai/ai-provider-factory";
import {
  markModelAnalysisFailure,
  markModelAnalysisSuccess,
} from "@/lib/ai/model-monitor-registry";
import { logger } from "@/lib/logger";
import {
  getAllAnalysisQueueStats,
  getAnalysisQueueByProvider,
} from "@/lib/queue/report-queues";
import { getReport, updateReport } from "@/lib/report-store";

const inFlightAnalysisTaskIds = new Set<string>();

function prioritizeRequestedProvider(providers: ReturnType<typeof createHealthReportAiProviders>, report: Awaited<ReturnType<typeof getReport>>) {
  if (!report.requestedProvider || !report.requestedModel) {
    return providers;
  }

  const matchedIndex = providers.findIndex(
    (provider) =>
      provider.providerName === report.requestedProvider &&
      provider.modelName === report.requestedModel,
  );

  if (matchedIndex <= 0) {
    return providers;
  }

  const matched = providers[matchedIndex]!;
  return [matched, ...providers.slice(0, matchedIndex), ...providers.slice(matchedIndex + 1)];
}

function scheduleModelMonitorUpdate(task: () => void) {
  queueMicrotask(() => {
    try {
      task();
    } catch {
      // 模型监控统计是辅助能力，不应影响核心分析链路。
    }
  });
}

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
    const providers = prioritizeRequestedProvider(createHealthReportAiProviders(), report);
    await logger.info("已加载 AI provider 链", {
      reportId,
      requestedProvider: report.requestedProvider,
      requestedModel: report.requestedModel,
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
        scheduleModelMonitorUpdate(() => {
          markModelAnalysisSuccess({
            provider: provider.providerName,
            model: provider.modelName,
            reportId,
          });
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
        scheduleModelMonitorUpdate(() => {
          markModelAnalysisFailure({
            provider: provider.providerName,
            model: provider.modelName,
            reportId,
            error: lastError,
          });
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
  const taskId = `analyze:${reportId}`;

  if (inFlightAnalysisTaskIds.has(taskId)) {
    void logger.info("报告分析任务已在队列中，跳过重复入队", {
      reportId,
      queues: getAllAnalysisQueueStats(),
    });
    return false;
  }

  inFlightAnalysisTaskIds.add(taskId);

  void (async () => {
    let queued = false;
    try {
      const report = await getReport(reportId);
      const providers = prioritizeRequestedProvider(
        createHealthReportAiProviders(),
        report,
      );
      const queueProvider = providers[0]?.providerName || report.requestedProvider || "default";
      const analysisQueue = getAnalysisQueueByProvider(queueProvider);

      if (analysisQueue.isFull()) {
        await logger.error("报告分析任务入队失败：provider 分区队列已满", {
          reportId,
          provider: queueProvider,
          queue: analysisQueue.getStats(),
          queues: getAllAnalysisQueueStats(),
        });
        await updateReport(reportId, (current) => ({
          ...current,
          status: "failed",
          errorMessage: "分析任务繁忙，请稍后重试。",
          analysis: null,
        }));
        return;
      }

      queued = true;
      await logger.info("报告分析任务已入队", {
        reportId,
        provider: queueProvider,
        queue: analysisQueue.getStats(),
        queues: getAllAnalysisQueueStats(),
      });

      await analysisQueue.enqueue(taskId, async () => {
        await logger.info("报告分析任务开始执行", {
          reportId,
          provider: queueProvider,
          queue: analysisQueue.getStats(),
          queues: getAllAnalysisQueueStats(),
        });
        await analyzeStoredReport(reportId);
      });
    } catch (error) {
      await logger.error("报告分析任务入队失败", {
        reportId,
        error,
      });
      if (!queued) {
        await updateReport(reportId, (current) => ({
          ...current,
          status: "failed",
          errorMessage: "分析任务入队失败，请稍后重试。",
          analysis: null,
        })).catch(() => undefined);
      }
    } finally {
      inFlightAnalysisTaskIds.delete(taskId);
    }
  })();

  return true;
}
