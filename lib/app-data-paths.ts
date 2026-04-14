import path from "node:path";

function resolvePathFromCwd(input: string) {
  return path.isAbsolute(input) ? input : path.join(process.cwd(), input);
}

export function getAppDataRoot() {
  return resolvePathFromCwd(process.env.APP_DATA_ROOT || "storage");
}

export function getSqliteDatabasePath() {
  const configured = process.env.SQLITE_DATABASE_PATH;
  if (configured) {
    return resolvePathFromCwd(configured);
  }

  return path.join(getAppDataRoot(), "data", "app.sqlite");
}

export function getLocalStorageRoot() {
  const configured = process.env.REPORT_LOCAL_STORAGE_ROOT;
  if (configured) {
    return resolvePathFromCwd(configured);
  }

  return path.join(getAppDataRoot(), "local");
}

export function getLogsRoot() {
  const configured = process.env.LOG_STORAGE_ROOT;
  if (configured) {
    return resolvePathFromCwd(configured);
  }

  return path.join(getAppDataRoot(), "logs");
}

export function getLegacyProjectStorageRoot() {
  return path.join(process.cwd(), "storage", "local");
}
