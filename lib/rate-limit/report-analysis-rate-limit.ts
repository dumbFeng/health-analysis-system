import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getSqliteDatabasePath } from "@/lib/app-data-paths";

type RateLimitRule = {
  windowMs: number;
  maxCount: number;
  windowLabel: string;
};

type ConsumeResult =
  | {
      ok: true;
      /** Present when a rate row was inserted; call `releaseReportAnalysisQuotaEvent` if the upload/analysis request later fails. */
      consumedEventId?: number;
    }
  | {
      ok: false;
      retryAfterSeconds: number;
      violatedRule: RateLimitRule;
    };

const unitMs: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

let database: DatabaseSync | null = null;
let parsedRulesCache: { raw: string; rules: RateLimitRule[] } | null = null;
let parsedWhitelistCache: { raw: string; userIds: Set<string> } | null = null;

function getSqlitePath() {
  return getSqliteDatabasePath();
}

function getDatabase() {
  if (!database) {
    const databasePath = getSqlitePath();
    mkdirSync(path.dirname(databasePath), { recursive: true });
    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS report_analysis_rate_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_report_analysis_rate_events_user_created
        ON report_analysis_rate_events(user_id, created_at_ms);
    `);
  }

  return database;
}

function parseRateLimitRules(raw: string) {
  const normalized = raw.trim();
  if (!normalized) {
    return [];
  }

  if (parsedRulesCache && parsedRulesCache.raw === normalized) {
    return parsedRulesCache.rules;
  }

  const rules = normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const matched = item.match(/^(\d+)([smhdw]):(\d+)$/i);
      if (!matched) {
        throw new Error(
          `REPORT_ANALYSIS_RATE_LIMITS 配置格式错误: ${item}，正确格式示例: 1h:5,1d:20`,
        );
      }

      const value = Number.parseInt(matched[1], 10);
      const unit = matched[2].toLowerCase();
      const count = Number.parseInt(matched[3], 10);
      const ms = unitMs[unit];
      if (!ms || value <= 0 || count <= 0) {
        throw new Error(
          `REPORT_ANALYSIS_RATE_LIMITS 配置值无效: ${item}，时间和次数都必须大于 0`,
        );
      }

      return {
        windowMs: value * ms,
        maxCount: count,
        windowLabel: `${value}${unit}`,
      } satisfies RateLimitRule;
    })
    .sort((a, b) => a.windowMs - b.windowMs);

  parsedRulesCache = {
    raw: normalized,
    rules,
  };
  return rules;
}

function getRateLimitRules() {
  return parseRateLimitRules(process.env.REPORT_ANALYSIS_RATE_LIMITS || "");
}

function parseWhitelistUserIds(raw: string) {
  const normalized = raw.trim();
  if (parsedWhitelistCache && parsedWhitelistCache.raw === normalized) {
    return parsedWhitelistCache.userIds;
  }

  const userIds = new Set(
    normalized
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  parsedWhitelistCache = {
    raw: normalized,
    userIds,
  };
  return userIds;
}

function isRateLimitBypassedUser(userId: string) {
  const whitelistUserIds = parseWhitelistUserIds(
    process.env.REPORT_ANALYSIS_RATE_LIMIT_WHITELIST_USER_IDS || "",
  );
  return whitelistUserIds.has(userId);
}

function formatDurationLabel(seconds: number) {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours} 小时 ${remainingMinutes} 分钟`
      : `${hours} 小时`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? `${days} 天 ${remainingHours} 小时`
    : `${days} 天`;
}

function formatWindowLabel(rule: RateLimitRule) {
  const matched = rule.windowLabel.match(/^(\d+)([smhdw])$/i);
  if (!matched) {
    return `当前时间段`;
  }

  const value = Number.parseInt(matched[1], 10);
  const unit = matched[2].toLowerCase();

  if (unit === "h" && value === 1) {
    return "本小时";
  }

  if (unit === "d" && value === 1) {
    return "今天";
  }

  if (unit === "w" && value === 1) {
    return "本周";
  }

  const unitLabel =
    unit === "s"
      ? "秒"
      : unit === "m"
        ? "分钟"
        : unit === "h"
          ? "小时"
          : unit === "d"
            ? "天"
            : "周";

  return `${value}${unitLabel}内`;
}

export function buildReportAnalysisRateLimitMessage(result: Extract<ConsumeResult, { ok: false }>) {
  const windowLabel = formatWindowLabel(result.violatedRule);
  const waitLabel = formatDurationLabel(result.retryAfterSeconds);
  return `${windowLabel}的分析次数已用完，请 ${waitLabel} 后再试。`;
}

/**
 * Rolls back a quota consumption when the request failed after `consumeReportAnalysisQuota` succeeded
 * (e.g. file write or DB insert error). Idempotent for unknown ids.
 */
export function releaseReportAnalysisQuotaEvent(consumedEventId: number): void {
  if (!Number.isFinite(consumedEventId) || consumedEventId <= 0) {
    return;
  }

  const database = getDatabase();
  database
    .prepare(`DELETE FROM report_analysis_rate_events WHERE id = ?`)
    .run(consumedEventId);
}

export function consumeReportAnalysisQuota(userId: string): ConsumeResult {
  const uid = userId.trim();
  if (!uid) {
    return { ok: true };
  }

  if (isRateLimitBypassedUser(uid)) {
    return { ok: true };
  }

  const rules = getRateLimitRules();
  if (rules.length === 0) {
    return { ok: true };
  }

  const database = getDatabase();
  const now = Date.now();
  const maxWindowMs = Math.max(...rules.map((rule) => rule.windowMs));
  const oldestToKeep = now - maxWindowMs - 60 * 1000;

  const countStatement = database.prepare(`
    SELECT COUNT(*) AS count
    FROM report_analysis_rate_events
    WHERE user_id = ? AND created_at_ms >= ?
  `);
  const firstStatement = database.prepare(`
    SELECT created_at_ms
    FROM report_analysis_rate_events
    WHERE user_id = ? AND created_at_ms >= ?
    ORDER BY created_at_ms ASC
    LIMIT 1
  `);
  const insertStatement = database.prepare(`
    INSERT INTO report_analysis_rate_events (user_id, created_at_ms)
    VALUES (?, ?)
  `);

  database.exec("BEGIN IMMEDIATE;");
  try {
    database
      .prepare("DELETE FROM report_analysis_rate_events WHERE created_at_ms < ?")
      .run(oldestToKeep);

    for (const rule of rules) {
      const start = now - rule.windowMs;
      const countRow = countStatement.get(uid, start) as { count: number };
      const used = Number(countRow?.count || 0);
      if (used >= rule.maxCount) {
        const firstRow = firstStatement.get(uid, start) as
          | { created_at_ms: number }
          | undefined;
        const retryAfterMs = firstRow
          ? Math.max(firstRow.created_at_ms + rule.windowMs - now, 1000)
          : rule.windowMs;
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
        database.exec("ROLLBACK;");
        return {
          ok: false,
          retryAfterSeconds,
          violatedRule: rule,
        };
      }
    }

    const insertResult = insertStatement.run(uid, now) as { lastInsertRowid: number };
    database.exec("COMMIT;");
    return {
      ok: true,
      consumedEventId: Number(insertResult.lastInsertRowid),
    };
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
