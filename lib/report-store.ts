import { randomUUID } from "node:crypto";
import path from "node:path";
import { getReportRepository } from "@/lib/db/report-repository-factory";
import { normalizeStoredReport } from "@/lib/report-analysis-normalizer";
import type {
  HealthReportAnalysis,
  PublicReport,
  PublicReportListPage,
  ReportListSummary,
  StoredReport,
} from "@/lib/report-types";
import {
  buildStorageKey,
  deleteStoredFile,
  getStorageKeyFromPath,
  getStoragePath,
  getStorageMode,
  listStoredKeys,
  readStoredFile,
  writeStoredFile,
} from "@/lib/storage-provider";

let legacyMigrationPromise: Promise<void> | null = null;

function isLegacyStoredReport(value: unknown): value is StoredReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredReport> & {
    fileKey?: string;
    fileLocation?: string;
    reportKey?: string;
    sourceFileKey?: string;
    sourceFileLocation?: string;
    analysisFileKey?: string;
    analysisFileLocation?: string;
  };

  return (
    typeof candidate.id === "string" &&
    typeof candidate.fileName === "string" &&
    (typeof candidate.sourceFilePath === "string" ||
      typeof candidate.sourceFileLocation === "string" ||
      typeof candidate.sourceFileKey === "string" ||
      typeof candidate.fileLocation === "string" ||
      typeof candidate.fileKey === "string") &&
    (typeof candidate.analysisFilePath === "string" ||
      typeof candidate.analysisFileLocation === "string" ||
      typeof candidate.analysisFileKey === "string" ||
      typeof candidate.reportKey === "string")
  );
}

async function migrateLegacyJsonReportsToDatabase() {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = (async () => {
      const repository = getReportRepository();
      const keys = await listStoredKeys("report");
      await Promise.all(
        keys
          .filter((key) => key.endsWith(".json"))
          .map(async (key) => {
            const content = await readStoredFile(key, "report");
            const parsed = JSON.parse(content.toString("utf8")) as unknown;
            if (!isLegacyStoredReport(parsed)) {
              return;
            }

            const report = normalizeStoredReport(parsed);
            await repository.save(report);
          }),
      );
    })();
  }

  return legacyMigrationPromise;
}

async function getRepository() {
  const repository = getReportRepository();
  await migrateLegacyJsonReportsToDatabase();
  return repository;
}

export async function createStoredReport(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  bytes: Uint8Array;
  requestedProvider: string | null;
  requestedModel: string | null;
}) {
  const id = randomUUID();
  const createdAt = new Date();
  const extension = path.extname(input.fileName) || ".pdf";
  const sourceFileKey = buildStorageKey({
    category: "upload",
    reportId: id,
    fileName: input.fileName,
    extension,
    createdAt,
  });
  const analysisFileKey = buildStorageKey({
    category: "report",
    reportId: id,
    fileName: input.fileName,
    extension: ".json",
    createdAt,
  });

  await writeStoredFile(sourceFileKey, input.bytes, "upload");

  try {
    return await getReportRepository().createMetadata({
      id,
      userId: input.userId,
      fileName: input.fileName,
      storageMode: getStorageMode(),
      sourceFilePath: getStoragePath(sourceFileKey, "upload"),
      analysisFilePath: getStoragePath(analysisFileKey, "report"),
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      status: "analyzing",
      requestedProvider: input.requestedProvider,
      requestedModel: input.requestedModel,
    });
  } catch (error) {
    await deleteStoredFile(sourceFileKey, "upload");
    throw error;
  }
}

export async function saveReport(report: StoredReport) {
  const normalized = normalizeStoredReport(report);

  if (normalized.analysis) {
    await writeStoredFile(
      getStorageKeyFromPath(normalized.analysisFilePath, "report"),
      JSON.stringify(normalized.analysis, null, 2),
      "report",
    );
  }

  await getReportRepository().save({
    ...normalized,
    analysis: null,
  });
}

export async function getReport(reportId: string, userId?: string) {
  const repository = await getRepository();
  const metadata = userId
    ? await repository.findByIdForUser(reportId, userId)
    : await repository.findById(reportId);

  if (!metadata) {
    throw new Error("Report not found");
  }

  const report = await hydrateReportAnalysis(metadata);
  return report;
}

export async function listReports(userId?: string) {
  const repository = await getRepository();
  const reports = await repository.list(userId);
  await Promise.all(
    reports.map(async (report) => {
      if (report.status !== "succeeded") {
        return;
      }

      const hydrated = await hydrateReportAnalysis(report);
      if (
        hydrated.analysis &&
        (report.analysisModel !== hydrated.analysis.model ||
          report.overallRiskLevel !== hydrated.analysis.executiveSummary.overallRiskLevel ||
          report.riskScore !== hydrated.analysis.executiveSummary.riskScore)
      ) {
        await saveReport(hydrated);
      }
    }),
  );

  return repository.list(userId);
}

export async function listReportIdsByStatus(
  status: StoredReport["status"],
  userId?: string,
) {
  const repository = await getRepository();
  return repository.listIdsByStatus(status, userId);
}

export async function listReportsPage(input: {
  userId?: string;
  cursor?: string | null;
  limit: number;
}): Promise<PublicReportListPage & { summary: ReportListSummary }> {
  const repository = await getRepository();
  const page = await repository.listPage(input);
  const summary = await repository.getSummary(input.userId);
  return {
    reports: page.reports.map(toPublicReport),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    summary,
  };
}

export async function updateReport(
  reportId: string,
  updater: (report: StoredReport) => StoredReport,
  userId?: string,
) {
  const current = await getReport(reportId, userId);
  const next = updater({
    ...current,
    updatedAt: new Date().toISOString(),
  });
  await saveReport(next);
  return next;
}

export async function deleteReport(reportId: string, userId?: string) {
  const report = await getReport(reportId, userId);
  await Promise.all([
    deleteStoredFile(getStorageKeyFromPath(report.sourceFilePath, "upload"), "upload"),
    deleteStoredFile(getStorageKeyFromPath(report.analysisFilePath, "report"), "report"),
    getReportRepository().delete(reportId, userId),
  ]);
}

export function toPublicReport(report: StoredReport): PublicReport {
  const {
    sourceFilePath,
    analysisFilePath,
    userId,
    analysis,
    ...publicReport
  } = report;
  void userId;
  return publicReport;
}

async function hydrateReportAnalysis(report: StoredReport) {
  if (report.analysis || report.status !== "succeeded") {
    return report;
  }

  try {
    const content = await readStoredFile(
      getStorageKeyFromPath(report.analysisFilePath, "report"),
      "report",
    );
    const parsed = JSON.parse(content.toString("utf8")) as unknown;
    const analysis = (
      parsed &&
      typeof parsed === "object" &&
      "analysis" in parsed &&
      (parsed as { analysis?: unknown }).analysis &&
      typeof (parsed as { analysis?: unknown }).analysis === "object"
        ? (parsed as { analysis: unknown }).analysis
        : parsed
    ) as HealthReportAnalysis;

    return normalizeStoredReport({
      ...report,
      analysis,
    });
  } catch {
    return report;
  }
}
