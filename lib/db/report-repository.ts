import type { ReportListPage, ReportListSummary, StoredReport } from "@/lib/report-types";

export type ReportMetadataInput = {
  id: string;
  userId: string;
  fileName: string;
  storageMode: StoredReport["storageMode"];
  sourceFilePath: string;
  analysisFilePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  status: StoredReport["status"];
  requestedProvider: string | null;
  requestedModel: string | null;
};

export type ReportRepository = {
  createMetadata(input: ReportMetadataInput): Promise<StoredReport>;
  save(report: StoredReport): Promise<void>;
  findById(reportId: string): Promise<StoredReport | null>;
  findByIdForUser(reportId: string, userId: string): Promise<StoredReport | null>;
  list(userId?: string): Promise<StoredReport[]>;
  listIdsByStatus(status: StoredReport["status"], userId?: string): Promise<string[]>;
  listPage(input: { userId?: string; cursor?: string | null; limit: number }): Promise<ReportListPage>;
  getSummary(userId?: string): Promise<ReportListSummary>;
  delete(reportId: string, userId?: string): Promise<void>;
};
