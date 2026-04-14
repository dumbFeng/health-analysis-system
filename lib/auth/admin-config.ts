import { isValidEmail, normalizeEmail } from "@/lib/auth/email";

export function getAdminEmails() {
  return (process.env.AUTH_ADMIN_EMAILS || "")
    .split(/[,\n]/)
    .map((item) => normalizeEmail(item))
    .filter((item, index, list) => isValidEmail(item) && list.indexOf(item) === index);
}

export function isAdminEmail(email: string) {
  return getAdminEmails().includes(normalizeEmail(email));
}
