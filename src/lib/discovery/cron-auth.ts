import { timingSafeEqual } from "node:crypto";

export function cronRequestAuthorized(authorization: string | null, secret: string | undefined) {
  if (!secret) return false;
  const provided = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}
