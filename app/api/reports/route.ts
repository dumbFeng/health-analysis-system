import { NextResponse } from "next/server";
import { ensureReportAnalysisRecovery } from "@/lib/ai/report-analysis-recovery";
import {
  createStoredReport,
  deleteReport,
  getReport,
  listReports,
  toPublicReport,
} from "@/lib/report-store";
import { enqueueReportAnalysis } from "@/lib/ai/health-report-analyzer";
import { logger } from "@/lib/logger";
import { uploadQueue } from "@/lib/queue/report-queues";

export const runtime = "nodejs";

export async function GET() {
  await ensureReportAnalysisRecovery();

  const reports = await listReports();
  await logger.debug("查询报告列表", {
    count: reports.length,
  });
  return NextResponse.json({ reports: reports.map(toPublicReport) });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    await logger.warn("上传报告失败：缺少文件", {});
    return NextResponse.json({ error: "请上传 PDF 文件。" }, { status: 400 });
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const report = await uploadQueue.enqueue(`upload:${file.name}:${Date.now()}`, async () => {
    await logger.info("上传任务开始执行", {
      fileName: file.name,
      fileSize: file.size,
      queue: uploadQueue.getStats(),
    });

    const createdReport = await createStoredReport({
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      fileSize: file.size,
      bytes,
    });

    await logger.info("上传任务执行完成", {
      reportId: createdReport.id,
      fileName: file.name,
      queue: uploadQueue.getStats(),
    });

    return createdReport;
  });

  await logger.info("报告上传成功", {
    reportId: report.id,
    fileName: file.name,
    fileSize: file.size,
  });

  enqueueReportAnalysis(report.id);

  return NextResponse.json({ report: toPublicReport(report) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    await logger.warn("删除报告失败：缺少报告 id", {});
    return NextResponse.json({ error: "缺少报告 id。" }, { status: 400 });
  }

  try {
    const report = await getReport(id);
    if (report.status === "analyzing") {
      await logger.warn("删除报告失败：报告仍在分析中", { reportId: id });
      return NextResponse.json(
        { error: "报告正在分析中，暂不支持删除。" },
        { status: 409 },
      );
    }

    await deleteReport(id);
  } catch (error) {
    await logger.warn("删除报告失败：报告不存在或删除异常", {
      reportId: id,
      error,
    });
    return NextResponse.json({ error: "报告不存在或删除失败。" }, { status: 404 });
  }

  await logger.info("报告删除成功", { reportId: id });
  return NextResponse.json({ ok: true }, { status: 200 });
}
