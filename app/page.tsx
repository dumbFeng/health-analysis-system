import { ReportDashboard } from "@/components/report-dashboard";
import { ensureReportAnalysisRecovery } from "@/lib/ai/report-analysis-recovery";
import { getCurrentAuthFromCookies } from "@/lib/auth/server";
import { getReportListPageSize } from "@/lib/report-list-config";
import { listReportsPage } from "@/lib/report-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const auth = await getCurrentAuthFromCookies();
  if (!auth) {
    return null;
  }

  void ensureReportAnalysisRecovery();

  const reportsPage = await listReportsPage({
    userId: auth.user.id,
    limit: getReportListPageSize(),
  });
  return (
    <ReportDashboard
      initialReports={reportsPage.reports}
      initialNextCursor={reportsPage.nextCursor}
      initialHasMore={reportsPage.hasMore}
      initialSummary={reportsPage.summary}
    />
  );
}
