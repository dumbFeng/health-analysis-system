import { randomUUID } from "node:crypto";
import path from "node:path";
import { normalizeStoredReport } from "@/lib/report-analysis-normalizer";
import type { PublicReport, StoredReport } from "@/lib/report-types";
import {
  buildStorageKey,
  getStorageMode,
  listStoredKeys,
  readStoredFile,
  writeStoredFile,
} from "@/lib/storage-provider";

export async function createStoredReport(input: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  bytes: Uint8Array;
}) {
  const id = randomUUID();
  const createdAt = new Date();
  const extension = path.extname(input.fileName) || ".pdf";
  const fileKey = buildStorageKey({
    category: "upload",
    reportId: id,
    fileName: input.fileName,
    extension,
    createdAt,
  });
  const reportKey = buildStorageKey({
    category: "report",
    reportId: id,
    fileName: input.fileName,
    extension: ".json",
    createdAt,
  });

  await writeStoredFile(fileKey, input.bytes, "upload");

  const report: StoredReport = {
    id,
    fileName: input.fileName,
    storageMode: getStorageMode(),
    fileKey,
    reportKey,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    status: "analyzing",
    patientName: null,
    examDate: null,
    institution: null,
    summary: null,
    errorMessage: null,
    analysis: null,
  };

  await saveReport(report);
  return report;
}

export async function saveReport(report: StoredReport) {
  await writeStoredFile(
    report.reportKey,
    JSON.stringify(normalizeStoredReport(report), null, 2),
    "report",
  );
}

export async function getReport(reportId: string) {
  const reports = await listReports();
  const report = reports.find((item) => item.id === reportId);

  if (!report) {
    throw new Error("Report not found");
  }

  return report;
}

export async function listReports() {
  const keys = await listStoredKeys("report");
  const records = await Promise.all(
    keys
      .filter((key) => key.endsWith(".json"))
      .map(async (key) => {
        const content = await readStoredFile(key, "report");
        return normalizeStoredReport(JSON.parse(content.toString("utf8")) as StoredReport);
      }),
  );

  return records.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function updateReport(
  reportId: string,
  updater: (report: StoredReport) => StoredReport,
) {
  const current = await getReport(reportId);
  const next = updater({
    ...current,
    updatedAt: new Date().toISOString(),
  });
  await saveReport(next);
  return next;
}

export function toPublicReport(report: StoredReport): PublicReport {
  const { fileKey, reportKey, analysis, ...publicReport } = report;
  return publicReport;
}
