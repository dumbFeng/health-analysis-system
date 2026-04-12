import { NextResponse } from "next/server";
import { createUnauthorizedResponse, requireAuth } from "@/lib/auth/server";
import { getReport, toPublicReport, updateReport } from "@/lib/report-store";
import { enqueueReportAnalysis } from "@/lib/ai/health-report-analyzer";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

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

  try {
    await getReport(id, auth.user.id);
  } catch {
    await logger.warn("重试分析失败：报告不存在", { reportId: id });
    return NextResponse.json({ error: "报告不存在。" }, { status: 404 });
  }

  const report = await updateReport(id, (current) => ({
    ...current,
    status: "analyzing",
    errorMessage: null,
  }), auth.user.id);
  await logger.info("手动触发报告重试分析", {
    reportId: id,
  });

  enqueueReportAnalysis(id);

  return NextResponse.json({ report: toPublicReport(report) }, { status: 202 });
}
