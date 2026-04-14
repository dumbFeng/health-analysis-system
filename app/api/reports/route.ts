import { NextResponse } from "next/server";
import { createUnauthorizedResponse, requireAuth } from "@/lib/auth/server";
import {
  createStoredReport,
  deleteReport,
  getReport,
  listReportsPage,
  toPublicReport,
} from "@/lib/report-store";
import { findAiModelOptionById } from "@/lib/ai/ai-model-options";
import { enqueueReportAnalysis } from "@/lib/ai/health-report-analyzer";
import { logger } from "@/lib/logger";
import { uploadQueue } from "@/lib/queue/report-queues";
import {
  buildReportAnalysisRateLimitMessage,
  consumeReportAnalysisQuota,
  releaseReportAnalysisQuotaEvent,
} from "@/lib/rate-limit/report-analysis-rate-limit";
import { getReportListPageSize } from "@/lib/report-list-config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request).catch(() => null);
  if (!auth) {
    return createUnauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const requestedLimit = Number.parseInt(searchParams.get("limit") || "", 10);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : getReportListPageSize();
  const page = await listReportsPage({
    userId: auth.user.id,
    cursor,
    limit,
  });
  await logger.debug("查询报告列表", {
    count: page.reports.length,
    hasMore: page.hasMore,
  });
  return NextResponse.json(page);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request).catch(() => null);
  if (!auth) {
    return createUnauthorizedResponse();
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const modelId = formData.get("modelId");

  if (!(file instanceof File)) {
    await logger.warn("上传报告失败：缺少文件", {});
    return NextResponse.json({ error: "请上传 PDF 文件。" }, { status: 400 });
  }

  const selectedModel =
    typeof modelId === "string" && modelId.trim()
      ? findAiModelOptionById(modelId.trim())
      : null;

  if (typeof modelId === "string" && modelId.trim() && !selectedModel) {
    return NextResponse.json(
      { error: "所选模型无效，请重新选择。" },
      { status: 400 },
    );
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    await logger.warn("上传报告失败：文件不是 PDF", {
      fileName: file.name,
      mimeType: file.type,
    });
    return NextResponse.json(
      { error: "当前仅支持 PDF 体检报告。" },
      { status: 400 },
    );
  }

  if (uploadQueue.isFull()) {
    await logger.warn("上传报告失败：上传队列已满", {
      fileName: file.name,
      queue: uploadQueue.getStats(),
    });
    return NextResponse.json(
      { error: "当前上传任务较多，请稍后再试。" },
      { status: 429 },
    );
  }

  const quota = consumeReportAnalysisQuota(auth.user.id);
  if (!quota.ok) {
    await logger.warn("上传报告失败：触发报告分析限频", {
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const report = await uploadQueue.enqueue(
      `upload:${file.name}:${Date.now()}`,
      async () => {
        await logger.info("上传任务开始执行", {
          fileName: file.name,
          fileSize: file.size,
          queue: uploadQueue.getStats(),
        });

        const createdReport = await createStoredReport({
          userId: auth.user.id,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          fileSize: file.size,
          bytes,
          requestedProvider: selectedModel?.provider || null,
          requestedModel: selectedModel?.model || null,
        });

        await logger.info("上传任务执行完成", {
          reportId: createdReport.id,
          fileName: file.name,
          queue: uploadQueue.getStats(),
        });

        return createdReport;
      },
    );

    await logger.info("报告上传成功", {
      reportId: report.id,
      fileName: file.name,
      fileSize: file.size,
    });

    enqueueReportAnalysis(report.id);

    return NextResponse.json({ report: toPublicReport(report) }, { status: 201 });
  } catch (error) {
    if (consumedEventId != null) {
      releaseReportAnalysisQuotaEvent(consumedEventId);
    }
    await logger.warn("上传报告失败：执行异常", {
      fileName: file.name,
      userId: auth.user.id,
      error,
    });
    return NextResponse.json({ error: "上传失败，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request).catch(() => null);
  if (!auth) {
    return createUnauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    await logger.warn("删除报告失败：缺少报告 id", {});
    return NextResponse.json({ error: "缺少报告 id。" }, { status: 400 });
  }

  try {
    const report = await getReport(id, auth.user.id);
    if (report.status === "analyzing") {
      await logger.warn("删除报告失败：报告仍在分析中", { reportId: id });
      return NextResponse.json(
        { error: "报告正在分析中，暂不支持删除。" },
        { status: 409 },
      );
    }

    await deleteReport(id, auth.user.id);
  } catch (error) {
    await logger.warn("删除报告失败：报告不存在或删除异常", {
      reportId: id,
      error,
    });
    return NextResponse.json(
      { error: "报告不存在或删除失败。" },
      { status: 404 },
    );
  }

  await logger.info("报告删除成功", { reportId: id });
  return NextResponse.json({ ok: true }, { status: 200 });
}
