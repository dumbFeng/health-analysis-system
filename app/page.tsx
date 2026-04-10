import { ReportDashboard } from "@/components/report-dashboard";
import { getAiHealthStatus } from "@/lib/ai/ai-health";
import { listReports, toPublicReport } from "@/lib/report-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [reports, aiHealth] = await Promise.all([
    listReports(),
    getAiHealthStatus(),
  ]);

  return (
    <ReportDashboard
      initialReports={reports.map(toPublicReport)}
      initialAiHealth={aiHealth}
    />
  );
}
