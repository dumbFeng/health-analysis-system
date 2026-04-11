import type { ReportRepository } from "@/lib/db/report-repository";
import { SqliteReportRepository } from "@/lib/db/sqlite-report-repository";

let repository: ReportRepository | null = null;

export function getReportRepository(): ReportRepository {
  if (repository) {
    return repository;
  }

  const driver = (
    process.env.DATABASE_DRIVER ||
    process.env.REPORT_DATABASE_DRIVER ||
    "sqlite"
  ).toLowerCase();

  switch (driver) {
    case "sqlite":
      repository = new SqliteReportRepository();
      return repository;
    case "mysql":
    case "postgres":
    case "postgresql":
      throw new Error(
        `数据库驱动 ${driver} 尚未启用。请先实现对应 repository 适配器。`,
      );
    default:
      throw new Error(`不支持的数据库驱动: ${driver}`);
  }
}
