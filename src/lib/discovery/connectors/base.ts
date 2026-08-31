import type {
  ConnectorMetrics,
  ConnectorResult,
  DiscoverySource,
  SourceHttpCacheEntry,
} from "../types";
import { canonicalizeSourceUrl, sha256 } from "../normalize";
import { assertSafeDiscoveryUrl, discoveryUrlMatchesDomain } from "../safety";

export type DiscoveryFetcher = typeof fetch;

export interface SourceConnector {
  fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult>;
}

export function emptyConnectorMetrics(
  overrides: Partial<ConnectorMetrics> = {},
): ConnectorMetrics {
  return {
    listingRequests: 0,
    detailRequests: 0,
    conditionalRequests: 0,
    notModifiedResponses: 0,
    hashUnchangedExits: 0,
    detailFetchesAvoided: 0,
    detailFetchesDeferred: 0,
    knownUrlSkips: 0,
    requestsSaved: 0,
    ...overrides,
  };
}

export function sourceHttpCacheEntry(source: DiscoverySource, url: string) {
  return source.httpCache?.[canonicalizeSourceUrl(url)];
}

const maximumResponseBytes = 2_000_000;
const retryableStatuses = new Set([502, 503, 504]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export async function fetchSourceText(
  source: DiscoverySource,
  fetcher: DiscoveryFetcher = fetch,
  options: {
    url?: string;
    accept?: "HTML" | "FEED";
    cache?: SourceHttpCacheEntry;
  } = {},
) {
  const url = assertSafeDiscoveryUrl(options.url ?? source.url);
  const cacheKey = canonicalizeSourceUrl(url.toString());
  if (!discoveryUrlMatchesDomain(url.toString(), source.domain)) {
    throw new Error("Configured discovery URL does not match the monitored source domain.");
  }
  const accept = options.accept === "HTML"
    ? "text/html, application/xhtml+xml;q=0.9, application/ld+json;q=0.7, */*;q=0.1"
    : "application/atom+xml, application/rss+xml, application/feed+json, application/json, text/html;q=0.7, */*;q=0.1";
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "GTAVIWorldio-Discovery/1.0 (+https://gtaviworld.io/about)",
  };
  if (options.cache?.etag) headers["If-None-Match"] = options.cache.etag;
  if (options.cache?.lastModified) {
    headers["If-Modified-Since"] = options.cache.lastModified;
  }
  const conditionalRequest = Boolean(
    headers["If-None-Match"] || headers["If-Modified-Since"],
  );
  let totalRequests = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      let currentUrl = url;
      let retry = false;
      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        const response = await fetcher(currentUrl, {
          headers,
          redirect: "manual",
          signal: controller.signal,
          cache: "no-store",
        });
        totalRequests += 1;
        if (redirectStatuses.has(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new Error("Source redirect did not include a destination.");
          if (redirectCount === 3) throw new Error("Source exceeded the discovery redirect limit.");
          currentUrl = assertSafeDiscoveryUrl(new URL(location, currentUrl).toString());
          if (!discoveryUrlMatchesDomain(currentUrl.toString(), source.domain)) {
            throw new Error("Source redirect left the monitored source domain.");
          }
          continue;
        }
        if (attempt === 0 && retryableStatuses.has(response.status)) {
          retry = true;
          break;
        }
        const declaredLength = Number(response.headers.get("content-length") ?? "0");
        if (declaredLength > maximumResponseBytes) {
          throw new Error("Source response exceeds the 2 MB discovery limit.");
        }
        const etag = response.headers.get("etag") ?? options.cache?.etag;
        const lastModified = response.headers.get("last-modified")
          ?? options.cache?.lastModified;
        const checkedAt = new Date().toISOString();
        if (response.status === 304) {
          return {
            finalUrl: currentUrl.toString(),
            httpStatus: response.status,
            text: "",
            responseBytes: 0,
            responseHash: options.cache?.contentHash ?? sha256(""),
            contentType: response.headers.get("content-type") ?? "",
            requestCount: totalRequests,
            conditionalRequest,
            notModified: true,
            cacheKey,
            cacheUpdate: {
              ...options.cache,
              ...(etag ? { etag } : {}),
              ...(lastModified ? { lastModified } : {}),
              checkedAt,
            },
          };
        }
        const text = await response.text();
        const responseBytes = new TextEncoder().encode(text).byteLength;
        if (responseBytes > maximumResponseBytes) {
          throw new Error("Source response exceeds the 2 MB discovery limit.");
        }
        if (!response.ok) {
          throw new Error(`Source returned HTTP ${response.status}.`);
        }
        return {
          finalUrl: currentUrl.toString(),
          httpStatus: response.status,
          text,
          responseBytes,
          responseHash: sha256(text),
          contentType: response.headers.get("content-type") ?? "",
          requestCount: totalRequests,
          conditionalRequest,
          notModified: false,
          cacheKey,
          cacheUpdate: {
            ...options.cache,
            ...(etag ? { etag } : {}),
            ...(lastModified ? { lastModified } : {}),
            contentHash: sha256(text),
            checkedAt,
          },
        };
      }
      if (retry) continue;
    } catch (error) {
      if (attempt === 0 && error instanceof TypeError) continue;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Source fetch exhausted its retry limit.");
}

export function connectorConfig<T extends Record<string, unknown>>(
  source: DiscoverySource,
  defaults: T,
) {
  return { ...defaults, ...source.connectorConfig } as T;
}

export function passesConfiguredIncludeTerms(source: DiscoverySource, ...values: Array<string | undefined>) {
  const configured = source.connectorConfig.includeTerms;
  if (!Array.isArray(configured)) return true;
  const terms = configured.filter((value): value is string => typeof value === "string" && value.trim().length >= 3);
  if (!terms.length) return true;
  const searchable = values.filter(Boolean).join(" ").toLowerCase();
  return terms.some((term) => searchable.includes(term.toLowerCase()));
}
