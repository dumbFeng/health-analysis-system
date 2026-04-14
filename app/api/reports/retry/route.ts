import { NextResponse } from "next/server";
import { createUnauthorizedResponse, requireAuth } from "@/lib/auth/server";
import { getReport, toPublicReport, updateReport } from "@/lib/report-store";
import { enqueueReportAnalysis } from "@/lib/ai/health-report-analyzer";
import { logger } from "@/lib/logger";
import {
  buildReportAnalysisRateLimitMessage,
  consumeReportAnalysisQuota,
  releaseReportAnalysisQuotaEvent,
} from "@/lib/rate-limit/report-analysis-rate-limit";

export const runtime = "nodejs";

function getMaxRetryCount() {
  const raw = process.env.REPORT_ANALYSIS_MAX_RETRIES || "2";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 2;
  }

  return parsed;
}

export async function POST(request: Request) {
  const auth = await requireAuth(request).catch(() => null);
  if (!auth) {
    return createUnauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    await logger.warn("重试分析失败：缺少报告 id", {});
    return NextResponse.json({ error: "缺少报告 id。" }, { status: 400 });
  }

  let currentReport;
  try {
    currentReport = await getReport(id, auth.user.id);
  } catch {
    await logger.warn("重试分析失败：报告不存在", { reportId: id });
    return NextResponse.json({ error: "报告不存在。" }, { status: 404 });
  }

  if (currentReport.status !== "failed") {
    await logger.warn("重试分析失败：报告状态不允许重试", {
      reportId: id,
      status: currentReport.status,
    });
    return NextResponse.json(
      { error: "仅分析失败的报告支持重试。" },
      { status: 409 },
    );
  }

  const maxRetryCount = getMaxRetryCount();
  if (currentReport.retryCount >= maxRetryCount) {
    await logger.warn("重试分析失败：超过单报告最大重试次数", {
      reportId: id,
      retryCount: currentReport.retryCount,
      maxRetryCount,
    });
    return NextResponse.json(
      { error: `该报告最多支持重试 ${maxRetryCount} 次。` },
      { status: 409 },
    );
  }

  const quota = consumeReportAnalysisQuota(auth.user.id);
  if (!quota.ok) {
    await logger.warn("手动重试分析失败：触发报告分析限频", {
      reportId: id,
      userId: auth.user.id,
      retryAfterSeconds: quota.retryAfterSeconds,
      window: quota.violatedRule.windowLabel,
      limit: quota.violatedRule.maxCount,
    });
    return NextResponse.json(
      {
        error: buildReportAnalysisRateLimitMessage(quota),
      },
      { status: 429 },
    );
  }

  const consumedEventId = quota.consumedEventId;

  try {
    const report = await updateReport(id, (current) => ({
      ...current,
      status: "analyzing",
      retryCount: current.retryCount + 1,
      errorMessage: null,
    }), auth.user.id);
    await logger.info("手动触发报告重试分析", {
      reportId: id,
    });

    enqueueReportAnalysis(id);

    return NextResponse.json({ report: toPublicReport(report) }, { status: 202 });
  } catch (error) {
    if (consumedEventId != null) {
      releaseReportAnalysisQuotaEvent(consumedEventId);
    }
    await logger.warn("手动重试分析失败：执行异常", {
      reportId: id,
      userId: auth.user.id,
      error,
    });
    return NextResponse.json({ error: "重试失败，请稍后再试。" }, { status: 500 });
  }
}
