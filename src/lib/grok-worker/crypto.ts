import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashPayload(value: unknown) {
  return sha256(stableJson(value));
}

export function tokenDigest(token: string, pepper: string) {
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function safeEqualHex(left: string, right: string) {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function generateOpaqueWorkerToken() {
  const prefix = `gwk_${randomBytes(6).toString("hex")}`;
  const secret = randomBytes(32).toString("base64url");
  return { prefix, token: `${prefix}.${secret}` };
}

export function deriveLeaseToken(seed: string, pepper: string) {
  return createHmac("sha256", pepper)
    .update(`grok-lease-v1:${seed}`)
    .digest("base64url");
}
