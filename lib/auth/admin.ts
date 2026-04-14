import { normalizeEmail } from "@/lib/auth/email";
import { decryptIdentity } from "@/lib/auth/sqlite-auth-repository";
import type { AuthUser } from "@/lib/auth/types";
import { isAdminEmail } from "./admin-config";

export function getUserEmail(user: AuthUser) {
  if (user.identityType !== "email") {
    return null;
  }

  const email = decryptIdentity(user.identityEncrypted);
  return email ? normalizeEmail(email) : null;
}

export function isAdminUser(user: AuthUser) {
  const email = getUserEmail(user);
  return email ? isAdminEmail(email) : false;
}
