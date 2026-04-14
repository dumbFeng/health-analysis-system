import { randomInt } from "node:crypto";

const inviteCodeCharset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function generateInviteCode(length = 8) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += inviteCodeCharset[randomInt(0, inviteCodeCharset.length)] || "";
  }

  return value;
}
