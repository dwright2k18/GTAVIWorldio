import { canonicalizeSourceUrl, decodeHtmlEntities, normalizeMeaningfulText, sha256 } from "../normalize";
import { discoveryUrlMatchesDomain } from "../safety";
import type { ConnectorItem, ConnectorResult, DiscoverySource } from "../types";
import { fetchSourceText, passesConfiguredIncludeTerms, type DiscoveryFetcher, type SourceConnector } from "./base";

function firstTag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return normalizeMeaningfulText(match[1]);
  }
  return undefined;
}

function linkFromBlock(block: string) {
  const atom = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
  if (atom) return decodeHtmlEntities(atom);
  return firstTag(block, ["link", "guid"]);
}

function feedBlocks(xml: string) {
  const itemMatches = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  if (itemMatches.length) return itemMatches;
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]);
}

export function parseFeedItems(
  xml: string,
  source: DiscoverySource,
  finalUrl: string,
  maximumItems = 25,
): ConnectorItem[] {
  const items: ConnectorItem[] = [];
  for (const block of feedBlocks(xml).slice(0, maximumItems)) {
    const title = firstTag(block, ["title"]);
    const rawUrl = linkFromBlock(block);
    if (!title || !rawUrl) continue;
    const canonicalUrl = canonicalizeSourceUrl(rawUrl, finalUrl);
    if (!discoveryUrlMatchesDomain(canonicalUrl, source.domain)) continue;
    const summary = firstTag(block, ["media:description", "description", "summary", "content:encoded", "content"]);
    if (!passesConfiguredIncludeTerms(source, title, summary)) continue;
    const author = firstTag(block, ["dc:creator", "author", "name"]);
    const publishedValue = firstTag(block, ["pubDate", "published", "updated", "dc:date"]);
    const publishedDate = publishedValue ? new Date(publishedValue) : undefined;
    const publishedAt = publishedDate && !Number.isNaN(publishedDate.valueOf()) ? publishedDate : undefined;
    const thumbnail = block.match(/<media:thumbnail\b[^>]*url=["']([^"']+)["'][^>]*>/i)?.[1];
    const videoId = firstTag(block, ["yt:videoId"]);
    const contentHash = sha256(`${title}\n${summary ?? ""}\n${publishedAt?.toISOString() ?? ""}\n${videoId ?? ""}`);
    items.push({
      title,
      url: canonicalUrl,
      canonicalUrl,
      author,
      summary,
      publishedAt,
      sourceHash: sha256(canonicalUrl),
      contentHash,
      changeType: "NEW_ARTICLE",
      directEvidence: source.isFirstParty,
      metadata: {
        connector: source.connectorKind,
        extractionMethod: source.domain === "youtube.com" ? "OFFICIAL_VIDEO_FEED" : "STRUCTURED_FEED",
        thumbnail: thumbnail ? decodeHtmlEntities(thumbnail) : null,
        videoId: videoId ?? null,
      },
    });
  }
  return items;
}

export class FeedConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const response = await fetchSourceText(source, fetcher);
    const maximumItems = typeof source.connectorConfig.maxItems === "number"
      ? Math.max(1, Math.min(50, Math.floor(source.connectorConfig.maxItems)))
      : 25;
    const items = parseFeedItems(response.text, source, response.finalUrl, maximumItems);
    const requireItems = source.connectorConfig.requireItems === true;
    const extractionSucceeded = items.length > 0 || !requireItems;
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: response.httpStatus,
      responseBytes: response.responseBytes,
      responseHash: response.responseHash,
      requestCount: response.requestCount,
      items,
      extractionMethod: source.domain === "youtube.com" ? "OFFICIAL_VIDEO_FEED" : "STRUCTURED_FEED",
      extractionSucceeded,
      health: extractionSucceeded ? "HEALTHY" : "FAILED",
      lastContentHash: response.responseHash,
      warnings: extractionSucceeded ? [] : ["The public feed was fetched but contained no required relevant items."],
    };
  }
}

export function parseJsonFeedItems(
  value: unknown,
  source: DiscoverySource,
  finalUrl: string,
  maximumItems = 25,
): ConnectorItem[] {
  if (!value || typeof value !== "object" || !("items" in value) || !Array.isArray(value.items)) return [];
  return value.items.slice(0, maximumItems).flatMap((entry): ConnectorItem[] => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const rawUrl = typeof raw.url === "string" ? raw.url : typeof raw.external_url === "string" ? raw.external_url : "";
    if (!title || !rawUrl) return [];
    const canonicalUrl = canonicalizeSourceUrl(rawUrl, finalUrl);
    if (!discoveryUrlMatchesDomain(canonicalUrl, source.domain)) return [];
    const summaryValue = typeof raw.summary === "string" ? raw.summary : typeof raw.content_text === "string" ? raw.content_text : "";
    const summary = normalizeMeaningfulText(summaryValue) || undefined;
    if (!passesConfiguredIncludeTerms(source, title, summary)) return [];
    const publishedValue = typeof raw.date_published === "string" ? new Date(raw.date_published) : undefined;
    const publishedAt = publishedValue && !Number.isNaN(publishedValue.valueOf()) ? publishedValue : undefined;
    return [{
      title: normalizeMeaningfulText(title),
      url: canonicalUrl,
      canonicalUrl,
      author: undefined,
      summary,
      publishedAt,
      sourceHash: sha256(canonicalUrl),
      contentHash: sha256(`${title}\n${summary ?? ""}`),
      changeType: "NEW_ARTICLE",
      directEvidence: source.isFirstParty,
      metadata: { connector: "JSON_FEED" },
    }];
  });
}

export class JsonFeedConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const response = await fetchSourceText(source, fetcher);
    const maximumItems = typeof source.connectorConfig.maxItems === "number"
      ? Math.max(1, Math.min(50, Math.floor(source.connectorConfig.maxItems)))
      : 25;
    const value = JSON.parse(response.text) as unknown;
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: response.httpStatus,
      responseBytes: response.responseBytes,
      responseHash: response.responseHash,
      requestCount: response.requestCount,
      items: parseJsonFeedItems(value, source, response.finalUrl, maximumItems),
      extractionMethod: "STRUCTURED_FEED",
      extractionSucceeded: true,
      health: "HEALTHY",
      lastContentHash: response.responseHash,
      warnings: [],
    };
  }
}
