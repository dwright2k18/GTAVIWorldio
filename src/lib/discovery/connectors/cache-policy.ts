import { canonicalizeSourceUrl } from "../normalize";
import type { DiscoverySource, SourceHttpCacheEntry } from "../types";

export const DEFAULT_DETAIL_REFRESH_MINUTES = 24 * 60;

function validDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function detailRefreshDue(options: {
  cache?: SourceHttpCacheEntry;
  fallbackCheckedAt?: Date | null;
  refreshMinutes?: number;
  now?: Date;
}) {
  const checkedAt = validDate(options.cache?.checkedAt)
    ?? validDate(options.fallbackCheckedAt);
  if (!checkedAt) return true;
  const refreshMinutes = Math.max(
    60,
    Math.floor(options.refreshMinutes ?? DEFAULT_DETAIL_REFRESH_MINUTES),
  );
  return (options.now ?? new Date()).valueOf() - checkedAt.valueOf()
    >= refreshMinutes * 60_000;
}

export function knownSourceUrls(source: DiscoverySource) {
  return new Set(
    (source.knownUrls ?? []).flatMap((url) => {
      try {
        return [canonicalizeSourceUrl(url)];
      } catch {
        return [];
      }
    }),
  );
}

export function seedKnownCacheEntry(
  source: DiscoverySource,
  url: string,
): SourceHttpCacheEntry {
  const key = canonicalizeSourceUrl(url);
  const current = source.httpCache?.[key];
  if (current?.checkedAt || !source.lastSuccessfulFetchAt) return current ?? {};
  return { ...current, checkedAt: source.lastSuccessfulFetchAt.toISOString() };
}
