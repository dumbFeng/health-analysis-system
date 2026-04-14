export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function maskEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [name, domain] = normalized.split("@");
  if (!name || !domain) {
    return normalized;
  }

  const visibleName = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${visibleName}${"*".repeat(Math.max(2, name.length - visibleName.length))}@${domain}`;
}

export function generateUsernameFromEmail(email: string) {
  const [name] = normalizeEmail(email).split("@");
  return name ? `健康伙伴${name.slice(0, 16)}` : "健康伙伴";
}
