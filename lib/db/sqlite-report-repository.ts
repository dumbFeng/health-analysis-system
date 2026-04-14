import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getLocalStorageRoot, getSqliteDatabasePath } from "@/lib/app-data-paths";
import type { ReportMetadataInput, ReportRepository } from "@/lib/db/report-repository";
import { normalizeStoredReport } from "@/lib/report-analysis-normalizer";
import type {
  ReportListPage,
  ReportListSummary,
  ReportStatus,
  StorageMode,
  StoredReport,
} from "@/lib/report-types";

type ReportRow = {
  id: string;
  owner_user_id: string | null;
  file_name: string;
  storage_mode: StorageMode;
  source_file_path: string;
  analysis_file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  status: ReportStatus;
  retry_count: number | null;
  patient_name: string | null;
  exam_date: string | null;
  institution: string | null;
  summary: string | null;
  analysis_model: string | null;
  overall_risk_level: StoredReport["overallRiskLevel"];
  risk_score: number | null;
  error_message: string | null;
};

let database: DatabaseSync | null = null;

function getSqlitePath() {
  return getSqliteDatabasePath();
}

function getColumns(database: DatabaseSync, table: string) {
  return database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
}

function hasColumn(database: DatabaseSync, table: string, column: string) {
  return getColumns(database, table).some((item) => item.name === column);
}

function ensureColumn(database: DatabaseSync, table: string, column: string, definition: string) {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

function dropColumnIfExists(database: DatabaseSync, table: string, column: string) {
  if (hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} DROP COLUMN ${column};`);
  }
}

function readColumnExpression(database: DatabaseSync, column: string) {
  return hasColumn(database, "reports", column) ? `COALESCE(${column}, '')` : "''";
}

function normalizeLocalPath(value: string, category: "uploads" | "reports") {
  const root = `${category}/`;
  const localRoot = getLocalStorageRoot().replaceAll("\\", "/");
  const normalized = value.replaceAll("\\", "/");

  if (!normalized) {
    return "";
  }

  if (normalized === category || normalized.startsWith(root)) {
    return normalized;
  }

  const legacyPrefix = `storage/local/${category}/`;
  if (normalized.startsWith(legacyPrefix)) {
    return `${category}/${normalized.slice(legacyPrefix.length)}`;
  }

  const absolutePrefix = `${localRoot}/${category}/`;
  if (normalized.startsWith(absolutePrefix)) {
    return `${category}/${normalized.slice(absolutePrefix.length)}`;
  }

  if (normalized.startsWith("pdf/") || normalized.startsWith("json/")) {
    return `${category}/${normalized}`;
  }

  return normalized;
}

function normalizeStoragePaths(report: StoredReport): StoredReport {
  if (report.storageMode !== "local") {
    return report;
  }

  return {
    ...report,
    sourceFilePath: normalizeLocalPath(report.sourceFilePath, "uploads"),
    analysisFilePath: normalizeLocalPath(report.analysisFilePath, "reports"),
  };
}

function migrateLegacyStorageColumns(database: DatabaseSync) {
  ensureColumn(database, "reports", "source_file_path", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "reports", "analysis_file_path", "TEXT NOT NULL DEFAULT ''");

  const sourcePathExpression = readColumnExpression(database, "source_file_path");
  const sourceLocationExpression = readColumnExpression(database, "source_file_location");
  const sourceKeyExpression = readColumnExpression(database, "source_file_key");
  const legacyFileLocationExpression = readColumnExpression(database, "file_location");
  const legacyFileKeyExpression = readColumnExpression(database, "file_key");
  const analysisPathExpression = readColumnExpression(database, "analysis_file_path");
  const analysisLocationExpression = readColumnExpression(database, "analysis_file_location");
  const analysisKeyExpression = readColumnExpression(database, "analysis_file_key");
  const legacyReportKeyExpression = readColumnExpression(database, "report_key");

  database.exec(`
    UPDATE reports
    SET
      source_file_path = COALESCE(
        NULLIF(${sourcePathExpression}, ''),
        NULLIF(${sourceLocationExpression}, ''),
        NULLIF(${sourceKeyExpression}, ''),
        NULLIF(${legacyFileLocationExpression}, ''),
        NULLIF(${legacyFileKeyExpression}, ''),
        ''
      ),
      analysis_file_path = COALESCE(
        NULLIF(${analysisPathExpression}, ''),
        NULLIF(${analysisLocationExpression}, ''),
        NULLIF(${analysisKeyExpression}, ''),
        NULLIF(${legacyReportKeyExpression}, ''),
        ''
      )
    WHERE source_file_path = '' OR analysis_file_path = '';
  `);

  const rows = database
    .prepare(`
      SELECT id, storage_mode, source_file_path, analysis_file_path
      FROM reports
      WHERE storage_mode = 'local'
    `)
    .all() as Array<{
    id: string;
    storage_mode: StorageMode;
    source_file_path: string;
    analysis_file_path: string;
  }>;

  const statement = database.prepare(`
    UPDATE reports
    SET source_file_path = ?, analysis_file_path = ?
    WHERE id = ?
  `);

  for (const row of rows) {
    const sourceFilePath = normalizeLocalPath(row.source_file_path, "uploads");
    const analysisFilePath = normalizeLocalPath(row.analysis_file_path, "reports");
    if (
      sourceFilePath !== row.source_file_path ||
      analysisFilePath !== row.analysis_file_path
    ) {
      statement.run(sourceFilePath, analysisFilePath, row.id);
    }
  }

  for (const column of [
    "source_file_key",
    "source_file_location",
    "source_file_url",
    "analysis_file_key",
    "analysis_file_location",
    "analysis_file_url",
    "file_key",
    "file_location",
    "file_url",
    "report_key",
    "analysis_json",
  ]) {
    dropColumnIfExists(database, "reports", column);
  }
}

function ensureReportOwnershipColumn(database: DatabaseSync) {
  ensureColumn(database, "reports", "owner_user_id", "TEXT");
  database.exec("CREATE INDEX IF NOT EXISTS idx_reports_owner_user_id ON reports(owner_user_id);");
}

function getDatabase() {
  if (!database) {
    const databasePath = getSqlitePath();
    mkdirSync(path.dirname(databasePath), { recursive: true });
    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT,
        file_name TEXT NOT NULL,
        storage_mode TEXT NOT NULL,
        source_file_path TEXT NOT NULL,
        analysis_file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        patient_name TEXT,
        exam_date TEXT,
        institution TEXT,
        summary TEXT,
        analysis_model TEXT,
        overall_risk_level TEXT,
        risk_score INTEGER,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON reports(updated_at);
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    `);
    migrateLegacyStorageColumns(database);
    ensureReportOwnershipColumn(database);
    ensureColumn(database, "reports", "analysis_model", "TEXT");
    ensureColumn(database, "reports", "overall_risk_level", "TEXT");
    ensureColumn(database, "reports", "risk_score", "INTEGER");
    ensureColumn(database, "reports", "retry_count", "INTEGER NOT NULL DEFAULT 0");
  }

  return database;
}

function assertRequiredReportMetadata(report: StoredReport) {
  const missing = [
    ["id", report.id],
    ["fileName", report.fileName],
    ["storageMode", report.storageMode],
    ["sourceFilePath", report.sourceFilePath],
    ["analysisFilePath", report.analysisFilePath],
    ["mimeType", report.mimeType],
    ["createdAt", report.createdAt],
    ["updatedAt", report.updatedAt],
    ["status", report.status],
  ]
    .filter(([, value]) => typeof value !== "string" || value.length === 0)
    .map(([key]) => key);

  if (!Number.isFinite(report.fileSize)) {
    missing.push("fileSize");
  }

  if (missing.length > 0) {
    throw new Error(`报告元数据不完整，无法写入数据库: ${missing.join(", ")}`);
  }
}

function rowToReport(row: ReportRow): StoredReport {
  return normalizeStoragePaths(normalizeStoredReport({
    id: row.id,
    userId: row.owner_user_id,
    fileName: row.file_name,
    storageMode: row.storage_mode,
    sourceFilePath: row.source_file_path,
    analysisFilePath: row.analysis_file_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    retryCount:
      typeof row.retry_count === "number" && Number.isFinite(row.retry_count)
        ? Math.max(0, Math.floor(row.retry_count))
        : 0,
    patientName: row.patient_name,
    examDate: row.exam_date,
    institution: row.institution,
    summary: row.summary,
    analysisModel: row.analysis_model,
    overallRiskLevel: row.overall_risk_level,
    riskScore: row.risk_score,
    errorMessage: row.error_message,
    analysis: null,
  }));
}

function encodeListCursor(row: Pick<ReportRow, "updated_at" | "id">) {
  return Buffer.from(JSON.stringify({ updatedAt: row.updated_at, id: row.id }), "utf8").toString(
    "base64url",
  );
}

function decodeListCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      updatedAt?: string;
      id?: string;
    };
    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }

    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

export class SqliteReportRepository implements ReportRepository {
  async createMetadata(input: ReportMetadataInput): Promise<StoredReport> {
    const report: StoredReport = {
      id: input.id,
      userId: input.userId,
      fileName: input.fileName,
      storageMode: input.storageMode,
      sourceFilePath: input.sourceFilePath,
      analysisFilePath: input.analysisFilePath,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      status: input.status,
      retryCount: 0,
      patientName: null,
      examDate: null,
      institution: null,
      summary: null,
      analysisModel: null,
      overallRiskLevel: null,
      riskScore: null,
      errorMessage: null,
      analysis: null,
    };

    await this.save(report);
    return report;
  }

  async save(report: StoredReport) {
    const normalized = normalizeStoragePaths(normalizeStoredReport(report));
    assertRequiredReportMetadata(normalized);
    const database = getDatabase();
    ensureReportOwnershipColumn(database);
    database
      .prepare(`
        INSERT INTO reports (
          id, owner_user_id, file_name, storage_mode, source_file_path, analysis_file_path,
          mime_type, file_size, created_at, updated_at, status, retry_count,
          patient_name, exam_date, institution, summary,
          analysis_model, overall_risk_level, risk_score, error_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          owner_user_id = excluded.owner_user_id,
          file_name = excluded.file_name,
          storage_mode = excluded.storage_mode,
          source_file_path = excluded.source_file_path,
          analysis_file_path = excluded.analysis_file_path,
          mime_type = excluded.mime_type,
          file_size = excluded.file_size,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          status = excluded.status,
          retry_count = excluded.retry_count,
          patient_name = excluded.patient_name,
          exam_date = excluded.exam_date,
          institution = excluded.institution,
          summary = excluded.summary,
          analysis_model = excluded.analysis_model,
          overall_risk_level = excluded.overall_risk_level,
          risk_score = excluded.risk_score,
          error_message = excluded.error_message
      `)
      .run(
        normalized.id,
        normalized.userId,
        normalized.fileName,
        normalized.storageMode,
        normalized.sourceFilePath,
        normalized.analysisFilePath,
        normalized.mimeType,
        normalized.fileSize,
        normalized.createdAt,
        normalized.updatedAt,
        normalized.status,
        normalized.retryCount,
        normalized.patientName,
        normalized.examDate,
        normalized.institution,
        normalized.summary,
        normalized.analysisModel,
        normalized.overallRiskLevel,
        normalized.riskScore,
        normalized.errorMessage,
      );
  }

  async findById(reportId: string) {
    const row = getDatabase()
      .prepare("SELECT * FROM reports WHERE id = ?")
      .get(reportId) as ReportRow | undefined;

    return row ? rowToReport(row) : null;
  }

  async findByIdForUser(reportId: string, userId: string) {
    const database = getDatabase();
    ensureReportOwnershipColumn(database);
    const row = database
      .prepare("SELECT * FROM reports WHERE id = ? AND owner_user_id = ?")
      .get(reportId, userId) as ReportRow | undefined;

    return row ? rowToReport(row) : null;
  }

  async list(userId?: string) {
    const database = getDatabase();
    ensureReportOwnershipColumn(database);
    const rows = userId
      ? (database
          .prepare("SELECT * FROM reports WHERE owner_user_id = ? ORDER BY updated_at DESC")
          .all(userId) as ReportRow[])
      : (database
          .prepare("SELECT * FROM reports ORDER BY updated_at DESC")
          .all() as ReportRow[]);

    return rows.map(rowToReport);
  }

  async listPage(input: { userId?: string; cursor?: string | null; limit: number }): Promise<ReportListPage> {
    const database = getDatabase();
    ensureReportOwnershipColumn(database);
    const limit = Math.max(1, Math.floor(input.limit));
    const cursor = decodeListCursor(input.cursor);

    const whereParts: string[] = [];
    const params: Array<string | number> = [];

    if (input.userId) {
      whereParts.push("owner_user_id = ?");
      params.push(input.userId);
    }

    if (cursor) {
      whereParts.push("(updated_at < ? OR (updated_at = ? AND id < ?))");
      params.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const rows = database
      .prepare(`
        SELECT * FROM reports
        ${whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `)
      .all(...params, limit + 1) as ReportRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeListCursor(pageRows[pageRows.length - 1]!) : null;

    return {
      reports: pageRows.map(rowToReport),
      nextCursor,
      hasMore,
    };
  }

  async getSummary(userId?: string): Promise<ReportListSummary> {
    const database = getDatabase();
    ensureReportOwnershipColumn(database);
    const row = userId
      ? (database
          .prepare(`
            SELECT
              COUNT(*) AS total_count,
              SUM(CASE WHEN status = 'analyzing' THEN 1 ELSE 0 END) AS analyzing_count,
              SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_count,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
            FROM reports
            WHERE owner_user_id = ?
          `)
          .get(userId) as {
            total_count: number | null;
            analyzing_count: number | null;
            succeeded_count: number | null;
            failed_count: number | null;
          })
      : (database
          .prepare(`
            SELECT
              COUNT(*) AS total_count,
              SUM(CASE WHEN status = 'analyzing' THEN 1 ELSE 0 END) AS analyzing_count,
              SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_count,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
            FROM reports
          `)
          .get() as {
            total_count: number | null;
            analyzing_count: number | null;
            succeeded_count: number | null;
            failed_count: number | null;
          });

    return {
      totalCount: Number(row.total_count || 0),
      analyzingCount: Number(row.analyzing_count || 0),
      succeededCount: Number(row.succeeded_count || 0),
      failedCount: Number(row.failed_count || 0),
    };
  }

  async delete(reportId: string, userId?: string) {
    const database = getDatabase();
    ensureReportOwnershipColumn(database);
    if (userId) {
      database.prepare("DELETE FROM reports WHERE id = ? AND owner_user_id = ?").run(reportId, userId);
      return;
    }

    database.prepare("DELETE FROM reports WHERE id = ?").run(reportId);
  }
}
