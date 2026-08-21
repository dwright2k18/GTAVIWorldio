import { canonicalizeSourceUrl, decodeHtmlEntities, normalizeMeaningfulText, sha256 } from "../normalize";
import { classifyMeaningfulChange } from "../change-detection";
import type { ConnectorItem, ConnectorResult, DiscoverySource } from "../types";
import { connectorConfig, fetchSourceText, passesConfiguredIncludeTerms, type DiscoveryFetcher, type SourceConnector } from "./base";

function pageTitle(html: string) {
  const openGraph = html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1];
  const title = openGraph ?? html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? normalizeMeaningfulText(title) : "";
}

function pageDescription(html: string) {
  const match = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
    ?? html.match(/<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1];
  return match ? normalizeMeaningfulText(match) : undefined;
}

function canonicalFromHtml(html: string, finalUrl: string) {
  const match = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
  return canonicalizeSourceUrl(match ?? finalUrl, finalUrl);
}

export function parseHtmlListing(
  html: string,
  source: DiscoverySource,
  finalUrl: string,
): ConnectorItem[] {
  const config = connectorConfig(source, { linkPrefixes: [] as string[], maxItems: 20 });
  const prefixes = Array.isArray(config.linkPrefixes)
    ? config.linkPrefixes.filter((value): value is string => typeof value === "string" && value.startsWith("/"))
    : [];
  const maximumItems = typeof config.maxItems === "number" ? Math.max(1, Math.min(40, Math.floor(config.maxItems))) : 20;
  const seen = new Set<string>();
  const items: ConnectorItem[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = normalizeMeaningfulText(match[2]);
    if (title.length < 8 || title.length > 220) continue;
    if (!passesConfiguredIncludeTerms(source, title)) continue;
    const canonicalUrl = canonicalizeSourceUrl(decodeHtmlEntities(match[1]), finalUrl);
    const pathname = new URL(canonicalUrl).pathname;
    if (prefixes.length && !prefixes.some((prefix) => pathname.startsWith(prefix))) continue;
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);
    items.push({
      title,
      url: canonicalUrl,
      canonicalUrl,
      sourceHash: sha256(canonicalUrl),
      contentHash: sha256(title),
      changeType: "NEW_ARTICLE",
      directEvidence: source.isFirstParty,
      metadata: { connector: "HTML_LISTING" },
    });
    if (items.length >= maximumItems) break;
  }
  return items;
}

export class HtmlListingConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const response = await fetchSourceText(source, fetcher);
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: response.httpStatus,
      responseBytes: response.responseBytes,
      responseHash: response.responseHash,
      requestCount: response.requestCount,
      items: parseHtmlListing(response.text, source, response.finalUrl),
      warnings: [],
    };
  }
}

export class HtmlChangeConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const response = await fetchSourceText(source, fetcher);
    const title = pageTitle(response.text) || source.name;
    const canonicalUrl = canonicalFromHtml(response.text, response.finalUrl);
    const description = pageDescription(response.text);
    const normalizedText = normalizeMeaningfulText(response.text).slice(0, 100_000);
    const item: ConnectorItem = {
      title,
      url: canonicalUrl,
      canonicalUrl,
      summary: description,
      sourceHash: sha256(canonicalUrl),
      contentHash: sha256(normalizedText),
      changeType: classifyMeaningfulChange(normalizedText),
      directEvidence: source.isFirstParty,
      metadata: {
        connector: "HTML_CHANGE",
        normalizedCharacterCount: normalizedText.length,
      },
    };
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: response.httpStatus,
      responseBytes: response.responseBytes,
      responseHash: response.responseHash,
      requestCount: response.requestCount,
      items: [item],
      warnings: [],
    };
  }
}
