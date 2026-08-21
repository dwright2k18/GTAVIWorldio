import { createHash } from "node:crypto";

const trackingParameters = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
]);

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function canonicalizeSourceUrl(value: string, baseUrl?: string) {
  const url = new URL(value, baseUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || trackingParameters.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function normalizeHeadline(value: string) {
  return decodeHtmlEntities(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bgrand theft auto (?:vi|6)\b/g, "gta vi")
    .replace(/\bgta 6\b/g, "gta vi")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeMeaningfulText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\b(?:utm_[a-z_]+|fbclid|gclid)=[^\s&]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function headlineTokens(value: string) {
  return new Set(
    normalizeHeadline(value)
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

export function jaccardSimilarity(left: string, right: string) {
  const leftTokens = headlineTokens(left);
  const rightTokens = headlineTokens(right);
  const union = new Set([...leftTokens, ...rightTokens]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / union.size;
}
