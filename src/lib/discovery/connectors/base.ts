import type { ConnectorResult, DiscoverySource } from "../types";
import { sha256 } from "../normalize";
import { assertSafeDiscoveryUrl } from "../safety";

export type DiscoveryFetcher = typeof fetch;

export interface SourceConnector {
  fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult>;
}

const maximumResponseBytes = 2_000_000;
const retryableStatuses = new Set([502, 503, 504]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export async function fetchSourceText(
  source: DiscoverySource,
  fetcher: DiscoveryFetcher = fetch,
) {
  const url = assertSafeDiscoveryUrl(source.url);
  let totalRequests = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      let currentUrl = url;
      let retry = false;
      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        const response = await fetcher(currentUrl, {
          headers: {
            Accept: "application/atom+xml, application/rss+xml, application/feed+json, application/json, text/html;q=0.9, */*;q=0.1",
            "User-Agent": "GTAVIWorldio-Discovery/1.0 (+https://gtaviworld.io/about)",
          },
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
