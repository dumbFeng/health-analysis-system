const defaultReportListPageSize = 10;

export function getReportListPageSize() {
  const parsed = Number.parseInt(process.env.REPORT_LIST_PAGE_SIZE || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultReportListPageSize;
  }

  return parsed;
}
