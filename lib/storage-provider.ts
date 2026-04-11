import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import OSS from "ali-oss";
import type { StorageMode } from "@/lib/report-types";

const storageMode = (process.env.REPORT_STORAGE_MODE || "local") as StorageMode;
const localRoot = path.join(process.cwd(), "storage", "local");
const localUploadsRoot = path.join(localRoot, "uploads");
const localReportsRoot = path.join(localRoot, "reports");
const localUploadsRelativeRoot = path.join("storage", "local", "uploads");
const localReportsRelativeRoot = path.join("storage", "local", "reports");

const ossPrefix = (process.env.OSS_BASE_PREFIX || "health-reports").replace(
  /^\/+|\/+$/g,
  "",
);

type StorageCategory = "upload" | "report";

function getLocalBaseDir(category: StorageCategory) {
  return category === "upload" ? localUploadsRoot : localReportsRoot;
}

function getLocalRelativeBaseDir(category: StorageCategory) {
  return category === "upload"
    ? localUploadsRelativeRoot
    : localReportsRelativeRoot;
}

function ensureOssConfig() {
  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;

  if (!region || !accessKeyId || !accessKeySecret || !bucket) {
    throw new Error(
      "OSS 模式缺少必要配置，请检查 OSS_REGION、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET。",
    );
  }

  return {
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    endpoint: process.env.OSS_ENDPOINT,
    secure: process.env.OSS_SECURE !== "false",
  };
}

function getOssClient() {
  return new OSS(ensureOssConfig());
}

async function ensureLocalDirForKey(key: string, category: StorageCategory) {
  const fullPath = path.join(getLocalBaseDir(category), key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  return fullPath;
}

async function walkLocalFiles(rootDir: string, nested = ""): Promise<string[]> {
  const currentDir = path.join(rootDir, nested);
  const entries = await readdir(currentDir, { withFileTypes: true });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(nested, entry.name);
      if (entry.isDirectory()) {
        return walkLocalFiles(rootDir, relativePath);
      }
      return [relativePath];
    }),
  );

  return files.flat();
}

async function listOssKeys(prefix: string) {
  const client = getOssClient();
  let marker: string | undefined;
  const keys: string[] = [];

  do {
    const result = await client.list({
      prefix,
      marker,
      "max-keys": 100,
    });

    const objects = result.objects ?? [];
    for (const object of objects) {
      if (object.name) {
        keys.push(object.name);
      }
    }

    marker = result.isTruncated ? result.nextMarker : undefined;
  } while (marker);

  return keys;
}

export function getStorageMode(): StorageMode {
  return storageMode === "oss" ? "oss" : "local";
}

export function getStoredFileLocation(key: string, category: StorageCategory) {
  if (getStorageMode() === "local") {
    return path.join(getLocalRelativeBaseDir(category), key);
  }

  return `${ossPrefix}/${category === "upload" ? "uploads" : "reports"}/${key}`;
}

export function getStoragePath(key: string, category: StorageCategory) {
  return getStoredFileLocation(key, category);
}

export function getStorageKeyFromPath(pathOrKey: string, category: StorageCategory) {
  if (getStorageMode() === "oss") {
    const prefix = `${ossPrefix}/${category === "upload" ? "uploads" : "reports"}/`;
    return pathOrKey.startsWith(prefix) ? pathOrKey.slice(prefix.length) : pathOrKey;
  }

  const prefix = `${getLocalRelativeBaseDir(category)}${path.sep}`;
  return pathOrKey.startsWith(prefix) ? pathOrKey.slice(prefix.length) : pathOrKey;
}

export function getStoredFileUrl(key: string, category: StorageCategory) {
  if (getStorageMode() === "local") {
    return "";
  }

  const config = ensureOssConfig();
  const protocol = config.secure ? "https" : "http";
  const host =
    config.endpoint ||
    `${config.bucket}.${config.region}.aliyuncs.com`;
  const normalizedHost = host.replace(/^https?:\/\//, "");
  return `${protocol}://${normalizedHost}/${getStoredFileLocation(key, category)}`;
}

export function buildStorageKey(params: {
  category: StorageCategory;
  reportId: string;
  fileName: string;
  extension: string;
  createdAt: Date;
}) {
  const yyyy = String(params.createdAt.getUTCFullYear());
  const mm = String(params.createdAt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(params.createdAt.getUTCDate()).padStart(2, "0");
  const safeName = params.fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_一-龥]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const categoryPrefix = params.category === "upload" ? "pdf" : "json";
  const fileBase =
    params.category === "upload"
      ? `${params.reportId}-${safeName || "report"}${params.extension}`
      : `${params.reportId}${params.extension}`;

  return `${categoryPrefix}/${yyyy}/${mm}/${dd}/${fileBase}`;
}

export async function writeStoredFile(
  key: string,
  bytes: Uint8Array | Buffer | string,
  category: StorageCategory,
) {
  if (getStorageMode() === "local") {
    const fullPath = await ensureLocalDirForKey(key, category);
    await writeFile(fullPath, bytes);
    return;
  }

  const client = getOssClient();
  const objectKey = `${ossPrefix}/${category === "upload" ? "uploads" : "reports"}/${key}`;
  const content = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes);
  await client.put(objectKey, content);
}

export async function readStoredFile(
  key: string,
  category: StorageCategory,
): Promise<Buffer> {
  if (getStorageMode() === "local") {
    const fullPath = path.join(getLocalBaseDir(category), key);
    return readFile(fullPath);
  }

  const client = getOssClient();
  const objectKey = `${ossPrefix}/${category === "upload" ? "uploads" : "reports"}/${key}`;
  const result = await client.get(objectKey);
  return Buffer.from(result.content);
}

export async function listStoredKeys(category: StorageCategory) {
  if (getStorageMode() === "local") {
    const baseDir = getLocalBaseDir(category);
    await mkdir(baseDir, { recursive: true });
    return walkLocalFiles(baseDir);
  }

  const prefix = `${ossPrefix}/${category === "upload" ? "uploads" : "reports"}/`;
  const keys = await listOssKeys(prefix);
  return keys.map((key) => key.slice(prefix.length)).filter(Boolean);
}

export async function deleteStoredFile(key: string, category: StorageCategory) {
  if (getStorageMode() === "local") {
    const fullPath = path.join(getLocalBaseDir(category), key);
    await rm(fullPath, { force: true });
    return;
  }

  const client = getOssClient();
  const objectKey = `${ossPrefix}/${category === "upload" ? "uploads" : "reports"}/${key}`;
  await client.delete(objectKey);
}
