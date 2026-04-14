import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getSqliteDatabasePath } from "@/lib/app-data-paths";
import { isAdminEmail } from "@/lib/auth/admin-config";
import { generateUsernameFromEmail, maskEmail, normalizeEmail } from "@/lib/auth/email";
import { generateInviteCode, normalizeInviteCode } from "@/lib/auth/invite-code";
import { generateUsername, maskPhone, normalizePhone } from "@/lib/auth/phone";
import type { AuthIdentityType, AuthUser } from "@/lib/auth/types";

type UserRow = {
  id: string;
  identity_type: AuthIdentityType;
  identity_encrypted: string;
  identity_hash: string;
  identity_masked: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type LoginCodeRow = {
  id: string;
  code_hash: string;
  expires_at: string;
  attempt_count: number | null;
};

type InviteCodeRow = {
  id: string;
  code: string;
  created_by_user_id: string;
  max_uses: number;
  used_count: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type InviteCodeStatus = "valid" | "expired" | "exhausted" | "not_found";

export type InviteCodeRecord = {
  id: string | null;
  code: string;
  createdByUserId: string | null;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: InviteCodeStatus;
  usable: boolean;
};

let database: DatabaseSync | null = null;

export type WechatProfile = {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
};

function getSqlitePath() {
  return getSqliteDatabasePath();
}

function getSecret(name: string, fallback: string) {
  const configured = process.env[name];
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`认证配置缺失: ${name}`);
  }

  return process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || fallback;
}

function getEncryptionKey() {
  const configured = process.env.AUTH_IDENTITY_ENCRYPTION_KEY;
  if (configured) {
    const base64 = Buffer.from(configured, "base64");
    if (base64.length === 32) {
      return base64;
    }

    const hex = Buffer.from(configured, "hex");
    if (hex.length === 32) {
      return hex;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("认证配置错误: AUTH_IDENTITY_ENCRYPTION_KEY 必须是 32 字节 base64 或 hex");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("认证配置缺失: AUTH_IDENTITY_ENCRYPTION_KEY");
  }

  return createHash("sha256")
    .update(getSecret("AUTH_IDENTITY_ENCRYPTION_KEY", "dev-only-identity-encryption-key"))
    .digest();
}

function getDatabase() {
  if (!database) {
    const databasePath = getSqlitePath();
    mkdirSync(path.dirname(databasePath), { recursive: true });
    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        identity_type TEXT NOT NULL,
        identity_encrypted TEXT NOT NULL,
        identity_hash TEXT NOT NULL UNIQUE,
        identity_masked TEXT NOT NULL,
        username TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_login_codes (
        id TEXT PRIMARY KEY,
        identity_type TEXT NOT NULL,
        identity_hash TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_invite_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        created_by_user_id TEXT NOT NULL,
        max_uses INTEGER NOT NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_invite_code_usages (
        id TEXT PRIMARY KEY,
        invite_code_id TEXT NOT NULL,
        user_id TEXT NOT NULL UNIQUE,
        used_at TEXT NOT NULL,
        FOREIGN KEY(invite_code_id) REFERENCES auth_invite_codes(id)
      );
    `);
    ensureAuthLoginCodeAttemptColumn(database);
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_auth_login_codes_identity
        ON auth_login_codes(identity_type, identity_hash, created_at);
      CREATE INDEX IF NOT EXISTS idx_auth_login_codes_identity_active
        ON auth_login_codes(identity_type, identity_hash, consumed_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_auth_invite_codes_expires_at
        ON auth_invite_codes(expires_at);
      CREATE INDEX IF NOT EXISTS idx_auth_invite_code_usages_invite_code_id
        ON auth_invite_code_usages(invite_code_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identity_hash ON users(identity_hash);
    `);
  }

  return database;
}

function getColumns(database: DatabaseSync, table: string) {
  return database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
}

function hasColumn(database: DatabaseSync, table: string, column: string) {
  return getColumns(database, table).some((item) => item.name === column);
}

function ensureAuthLoginCodeAttemptColumn(database: DatabaseSync) {
  if (!hasColumn(database, "auth_login_codes", "attempt_count")) {
    database.exec("ALTER TABLE auth_login_codes ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;");
  }
}

function hmac(value: string, secretName: string, fallback: string) {
  return createHmac("sha256", getSecret(secretName, fallback)).update(value).digest("hex");
}

function hashIdentity(type: AuthIdentityType, value: string) {
  const normalized = type === "email" ? normalizeEmail(value) : type === "phone" ? normalizePhone(value) : value;
  return hmac(`${type}:${normalized}`, "AUTH_IDENTITY_HASH_SECRET", "dev-only-identity-hash-secret");
}

function hashCode(identityHash: string, code: string) {
  return hmac(`${identityHash}:${code}`, "AUTH_LOGIN_CODE_SECRET", "dev-only-login-code-secret");
}

function encryptText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptIdentity(encryptedValue: string) {
  const [ivText, tagText, encryptedText] = encryptedValue.split(".");
  if (!ivText || !tagText || !encryptedText) {
    return "";
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function rowToUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    identityType: row.identity_type,
    identityEncrypted: row.identity_encrypted,
    identityHash: row.identity_hash,
    identityMasked: row.identity_masked,
    username: row.username,
    avatarUrl: row.avatar_url || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInviteCode(row: InviteCodeRow): InviteCodeRecord {
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  const exhausted = row.used_count >= row.max_uses;
  const status: InviteCodeStatus = expired
    ? "expired"
    : exhausted
      ? "exhausted"
      : "valid";

  return {
    id: row.id,
    code: row.code,
    createdByUserId: row.created_by_user_id,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    remainingUses: Math.max(0, row.max_uses - row.used_count),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status,
    usable: status === "valid",
  };
}

function findUserByIdentityHash(identityHash: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM users WHERE identity_hash = ?")
    .get(identityHash) as UserRow | undefined;

  return row ? rowToUser(row) : null;
}

function buildEmailUser(normalizedEmail: string) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    identityType: "email" as const,
    identityEncrypted: encryptText(normalizedEmail),
    identityHash: hashIdentity("email", normalizedEmail),
    identityMasked: maskEmail(normalizedEmail),
    username: generateUsernameFromEmail(normalizedEmail),
    avatarUrl: "",
    createdAt: now,
    updatedAt: now,
  } satisfies AuthUser;
}

function insertUser(database: DatabaseSync, user: AuthUser) {
  database
    .prepare(`
      INSERT INTO users (
        id, identity_type, identity_encrypted, identity_hash, identity_masked,
        username, avatar_url, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      user.id,
      user.identityType,
      user.identityEncrypted,
      user.identityHash,
      user.identityMasked,
      user.username,
      user.avatarUrl,
      user.createdAt,
      user.updatedAt,
    );
}

function getInviteCodeStatusInternal(database: DatabaseSync, code: string): InviteCodeRecord {
  const normalizedCode = normalizeInviteCode(code);
  if (!normalizedCode) {
    return {
      id: null,
      code: "",
      createdByUserId: null,
      maxUses: 0,
      usedCount: 0,
      remainingUses: 0,
      expiresAt: null,
      createdAt: null,
      updatedAt: null,
      status: "not_found",
      usable: false,
    };
  }

  const row = database
    .prepare("SELECT * FROM auth_invite_codes WHERE code = ?")
    .get(normalizedCode) as InviteCodeRow | undefined;

  if (!row) {
    return {
      id: null,
      code: normalizedCode,
      createdByUserId: null,
      maxUses: 0,
      usedCount: 0,
      remainingUses: 0,
      expiresAt: null,
      createdAt: null,
      updatedAt: null,
      status: "not_found",
      usable: false,
    };
  }

  return rowToInviteCode(row);
}

function assertInviteCodeUsable(database: DatabaseSync, code: string) {
  const status = getInviteCodeStatusInternal(database, code);
  if (status.usable && status.id) {
    return status;
  }

  if (status.status === "expired") {
    throw new Error("邀请码已过期。");
  }

  if (status.status === "exhausted") {
    throw new Error("邀请码可用次数已耗尽。");
  }

  throw new Error("邀请码无效。");
}

function consumeInviteCodeForUser(database: DatabaseSync, code: string, userId: string) {
  const invite = assertInviteCodeUsable(database, code);
  const now = new Date().toISOString();
  database
    .prepare(`
      INSERT INTO auth_invite_code_usages (id, invite_code_id, user_id, used_at)
      VALUES (?, ?, ?, ?)
    `)
    .run(randomUUID(), invite.id, userId, now);
  database
    .prepare(`
      UPDATE auth_invite_codes
      SET used_count = used_count + 1, updated_at = ?
      WHERE id = ?
    `)
    .run(now, invite.id);
}

function createLoginCodeForIdentity(type: AuthIdentityType, value: string) {
  const identityHash = hashIdentity(type, value);
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const recentCode = getDatabase()
    .prepare(`
      SELECT expires_at
      FROM auth_login_codes
      WHERE identity_type = ? AND identity_hash = ? AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(type, identityHash) as { expires_at: string } | undefined;

  if (
    recentCode &&
    new Date(recentCode.expires_at).getTime() - Date.now() > 4 * 60 * 1000
  ) {
    throw new Error("验证码发送过于频繁，请稍后再试。");
  }

  getDatabase()
    .prepare(`
      INSERT INTO auth_login_codes (
        id, identity_type, identity_hash, code_hash, expires_at, attempt_count, consumed_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
    `)
    .run(randomUUID(), type, identityHash, hashCode(identityHash, code), expiresAt.toISOString(), now.toISOString());

  return {
    code,
    expiresAt: expiresAt.toISOString(),
  };
}

function consumeLoginCodeForIdentity(type: AuthIdentityType, value: string, code: string) {
  const identityHash = hashIdentity(type, value);
  const codeHash = hashCode(identityHash, code);
  const row = getDatabase()
    .prepare(`
      SELECT id, code_hash, expires_at, attempt_count
      FROM auth_login_codes
      WHERE identity_type = ? AND identity_hash = ? AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(type, identityHash) as LoginCodeRow | undefined;

  if (!row) {
    return false;
  }

  const now = new Date().toISOString();
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDatabase()
      .prepare("UPDATE auth_login_codes SET consumed_at = ? WHERE id = ?")
      .run(now, row.id);
    return false;
  }

  if ((row.attempt_count ?? 0) >= 5) {
    getDatabase()
      .prepare("UPDATE auth_login_codes SET consumed_at = ? WHERE id = ?")
      .run(now, row.id);
    return false;
  }

  if (row.code_hash !== codeHash) {
    getDatabase()
      .prepare("UPDATE auth_login_codes SET attempt_count = attempt_count + 1 WHERE id = ?")
      .run(row.id);
    return false;
  }

  getDatabase()
    .prepare("DELETE FROM auth_login_codes WHERE expires_at < ?")
    .run(now);
  getDatabase()
    .prepare("UPDATE auth_login_codes SET consumed_at = ? WHERE id = ?")
    .run(now, row.id);
  return true;
}

export function createLoginCode(phone: string) {
  return createLoginCodeForIdentity("phone", normalizePhone(phone));
}

export function createEmailLoginCode(email: string) {
  return createLoginCodeForIdentity("email", normalizeEmail(email));
}

export function consumeLoginCode(phone: string, code: string) {
  return consumeLoginCodeForIdentity("phone", normalizePhone(phone), code);
}

export function consumeEmailLoginCode(email: string, code: string) {
  return consumeLoginCodeForIdentity("email", normalizeEmail(email), code);
}

export function findUserById(userId: string) {
  const row = getDatabase()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserByEmail(email: string) {
  return findUserByIdentityHash(hashIdentity("email", normalizeEmail(email)));
}

export function createUserByEmailWithInvite(email: string, inviteCode: string) {
  const normalized = normalizeEmail(email);
  const existing = findUserByEmail(normalized);
  if (existing) {
    return { user: existing, created: false };
  }

  const database = getDatabase();
  const user = buildEmailUser(normalized);
  database.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    if (!isAdminEmail(normalized)) {
      if (!normalizeInviteCode(inviteCode || "")) {
        throw new Error("首次登录需要邀请码。");
      }

      consumeInviteCodeForUser(database, inviteCode, user.id);
    }

    insertUser(database, user);
    database.exec("COMMIT");
    return { user, created: true };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getOrCreateUserByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const identityHash = hashIdentity("phone", normalized);
  const existing = getDatabase()
    .prepare("SELECT * FROM users WHERE identity_hash = ?")
    .get(identityHash) as UserRow | undefined;

  if (existing) {
    return { user: rowToUser(existing), created: false };
  }

  const now = new Date().toISOString();
  const user: AuthUser = {
    id: randomUUID(),
    identityType: "phone",
    identityEncrypted: encryptText(normalized),
    identityHash,
    identityMasked: maskPhone(normalized),
    username: generateUsername(normalized),
    avatarUrl: "",
    createdAt: now,
    updatedAt: now,
  };

  getDatabase()
    .prepare(`
      INSERT INTO users (
        id, identity_type, identity_encrypted, identity_hash, identity_masked,
        username, avatar_url, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(user.id, user.identityType, user.identityEncrypted, user.identityHash, user.identityMasked, user.username, user.avatarUrl, user.createdAt, user.updatedAt);

  return { user, created: true };
}

export function getOrCreateUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const existing = findUserByEmail(normalized);
  if (existing) {
    return { user: existing, created: false };
  }

  const database = getDatabase();
  const user = buildEmailUser(normalized);
  database.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    if (!isAdminEmail(normalized)) {
      throw new Error("首次登录需要邀请码。");
    }

    insertUser(database, user);
    database.exec("COMMIT");
    return { user, created: true };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getOrCreateUserByEmailWithInvite(email: string, inviteCode?: string) {
  return createUserByEmailWithInvite(email, inviteCode || "");
}

export function getInviteCodeStatus(code: string) {
  return getInviteCodeStatusInternal(getDatabase(), code);
}

export function createInviteCodeRecord(input: {
  createdByUserId: string;
  maxUses: number;
  expiresInMs: number;
}) {
  const database = getDatabase();
  const maxUses = Math.max(1, Math.floor(input.maxUses));
  const expiresInMs = Math.max(60 * 1000, Math.floor(input.expiresInMs));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMs).toISOString();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateInviteCode();
    const invite: InviteCodeRecord = {
      id: randomUUID(),
      code,
      createdByUserId: input.createdByUserId,
      maxUses,
      usedCount: 0,
      remainingUses: maxUses,
      expiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: "valid",
      usable: true,
    };

    try {
      database
        .prepare(`
          INSERT INTO auth_invite_codes (
            id, code, created_by_user_id, max_uses, used_count, expires_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          invite.id,
          invite.code,
          invite.createdByUserId,
          invite.maxUses,
          invite.usedCount,
          invite.expiresAt,
          invite.createdAt,
          invite.updatedAt,
        );
      return invite;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: auth_invite_codes.code")
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("邀请码生成失败，请稍后重试。");
}

export function listInviteCodeRecords(limit = 20) {
  const rows = getDatabase()
    .prepare(`
      SELECT * FROM auth_invite_codes
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(Math.max(1, Math.floor(limit))) as InviteCodeRow[];

  return rows.map(rowToInviteCode);
}

function getWechatIdentityValue(profile: WechatProfile) {
  return profile.unionid || profile.openid;
}

export function getOrCreateUserByWechat(profile: WechatProfile) {
  const identityValue = getWechatIdentityValue(profile);
  const identityHash = hashIdentity("wechat", identityValue);
  const database = getDatabase();
  const existing = database
    .prepare("SELECT * FROM users WHERE identity_hash = ? LIMIT 1")
    .get(identityHash) as UserRow | undefined;
  const now = new Date().toISOString();

  if (existing) {
    database
      .prepare(`
        UPDATE users
        SET
          username = COALESCE(NULLIF(?, ''), username),
          avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
          identity_type = 'wechat',
          identity_hash = ?,
          identity_encrypted = ?,
          identity_masked = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        profile.nickname || "",
        profile.headimgurl || "",
        identityHash,
        encryptText(JSON.stringify(profile)),
        profile.nickname || "微信用户",
        now,
        existing.id,
      );
    return {
      user: rowToUser({
        ...existing,
        identity_type: "wechat",
        identity_hash: identityHash,
        identity_encrypted: encryptText(JSON.stringify(profile)),
        identity_masked: profile.nickname || "微信用户",
        username: profile.nickname || existing.username,
        avatar_url: profile.headimgurl || existing.avatar_url,
        updated_at: now,
      }),
      created: false,
    };
  }

  const user: AuthUser = {
    id: randomUUID(),
    identityType: "wechat",
    identityEncrypted: encryptText(JSON.stringify(profile)),
    identityHash,
    identityMasked: profile.nickname || "微信用户",
    username: profile.nickname || "微信用户",
    avatarUrl: profile.headimgurl || "",
    createdAt: now,
    updatedAt: now,
  };

  database
    .prepare(`
      INSERT INTO users (
        id, identity_type, identity_encrypted, identity_hash, identity_masked,
        username, avatar_url, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(user.id, user.identityType, user.identityEncrypted, user.identityHash, user.identityMasked, user.username, user.avatarUrl, user.createdAt, user.updatedAt);

  return { user, created: true };
}
