import type { StoredReport } from "@/lib/report-types";

export type ReportMetadataInput = {
  id: string;
  fileName: string;
  storageMode: StoredReport["storageMode"];
  sourceFilePath: string;
  analysisFilePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  status: StoredReport["status"];
};

export type ReportRepository = {
  createMetadata(input: ReportMetadataInput): Promise<StoredReport>;
  save(report: StoredReport): Promise<void>;
  findById(reportId: string): Promise<StoredReport | null>;
  list(): Promise<StoredReport[]>;
  delete(reportId: string): Promise<void>;
};
