import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getLogsRoot } from "@/lib/app-data-paths";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const logsRoot = getLogsRoot();
const terminalLevelColor: Record<LogLevel, string> = {
  error: "\x1b[31m",
  warn: "\x1b[33m",
  info: "\x1b[37m",
  debug: "\x1b[32m",
};
const terminalColorReset = "\x1b[0m";

function getLogFilePath(date = new Date()) {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return path.join(logsRoot, yyyy, mm, `${dd}.log`);
}

async function persistLogLine(line: string, date = new Date()) {
  const filePath = getLogFilePath(date);
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${line}\n`, "utf8");
}

function safeSerializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

function createLogLine(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  return JSON.stringify(payload);
}

function colorizeTerminalLogLine(level: LogLevel, line: string) {
  return `${terminalLevelColor[level]}${line}${terminalColorReset}`;
}

export async function writeLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
) {
  const normalizedContext =
    context && "error" in context
      ? {
          ...context,
          error: safeSerializeError(context.error),
        }
      : context;

  const line = createLogLine(level, message, normalizedContext);
  const terminalLine = colorizeTerminalLogLine(level, line);

  if (level === "error") {
    console.error(terminalLine);
  } else if (level === "warn") {
    console.warn(terminalLine);
  } else {
    console.log(terminalLine);
  }

  try {
    await persistLogLine(line);
  } catch (error) {
    console.error(
      createLogLine("error", "日志持久化失败", {
        originalMessage: message,
        error: safeSerializeError(error),
      }),
    );
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    return writeLog("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    return writeLog("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    return writeLog("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    return writeLog("error", message, context);
  },
};
