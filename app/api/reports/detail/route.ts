import { NextResponse } from "next/server";
import { ensureReportAnalysisRecovery } from "@/lib/ai/report-analysis-recovery";
import { createUnauthorizedResponse, requireAuth } from "@/lib/auth/server";
import { getReport, toPublicReport } from "@/lib/report-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request).catch(() => null);
  if (!auth) {
    return createUnauthorizedResponse();
  }

  await ensureReportAnalysisRecovery();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少报告 id。" }, { status: 400 });
  }

  try {
    const report = await getReport(id, auth.user.id);
    return NextResponse.json({ report: toPublicReport(report) });
  } catch {
    return NextResponse.json({ error: "报告不存在。" }, { status: 404 });
  }
}
