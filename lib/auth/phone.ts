export function normalizePhone(phone: string) {
  return phone.replace(/[\s-]/g, "").trim();
}

export function isValidPhone(phone: string) {
  return /^(\+?\d{8,15})$/.test(normalizePhone(phone));
}

export function maskPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 7) {
    return normalized.replace(/.(?=.{2})/g, "*");
  }

  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

export function generateUsername(phone: string) {
  const normalized = normalizePhone(phone);
  const suffix = normalized.slice(-4) || "0000";
  return `健康伙伴${suffix}`;
}
