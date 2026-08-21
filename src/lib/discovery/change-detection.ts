import { normalizeMeaningfulText, sha256 } from "./normalize";

export function meaningfulContentHash(html: string) {
  return sha256(normalizeMeaningfulText(html));
}
export function classifyMeaningfulChange(text: string) {
  if (/\b(?:release date|launches? on|coming (?:on|in)|delayed? (?:to|until))\b/i.test(text)) return "RELEASE_DATE_CHANGE" as const;
  if (/\b(?:playstation|xbox|pc|platforms?)\b/i.test(text)) return "PLATFORM_CHANGE" as const;
  if (/\b(?:price|pricing|\$\d+|£\d+|€\d+)\b/i.test(text)) return "PRICE_CHANGE" as const;
  if (/\b(?:preorder|pre-order|pre order)\b/i.test(text)) return "PREORDER_CHANGE" as const;
  if (/\b(?:new trailer|trailer \d|watch trailer|video premiere)\b/i.test(text)) return "TRAILER_ADDED" as const;
  if (/\b(?:new screenshot|screenshots added|new artwork)\b/i.test(text)) return "SCREENSHOT_ADDED" as const;
  if (/\b(?:description|metadata|open graph|schema)\b/i.test(text)) return "METADATA_CHANGE" as const;
  return "TEXT_UPDATE" as const;
}

export function isMeaningfulHashChange(previousHash: string | null | undefined, nextHash: string) {
  return Boolean(previousHash && previousHash !== nextHash);
}
