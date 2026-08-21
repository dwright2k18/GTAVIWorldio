import { classifyMeaningfulChange } from "../change-detection";
import { canonicalizeSourceUrl, decodeHtmlEntities, normalizeMeaningfulText, sha256 } from "../normalize";
import { discoveryUrlMatchesDomain } from "../safety";
import type { ConnectorItem, ConnectorResult, DiscoverySource, ExtractionMethod } from "../types";
import { connectorConfig, fetchSourceText, passesConfiguredIncludeTerms, type DiscoveryFetcher, type SourceConnector } from "./base";

function attributes(tag: string) {
  const values = new Map<string, string>();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
    values.set(match[1].toLowerCase(), decodeHtmlEntities(match[2]));
  }
  return values;
}

function metaContent(html: string, key: string) {
  const normalizedKey = key.toLowerCase();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const values = attributes(match[0]);
    if ((values.get("property") ?? values.get("name") ?? "").toLowerCase() === normalizedKey) {
      return values.get("content");
    }
  }
  return undefined;
}

function pageTitle(html: string) {
  const title = metaContent(html, "og:title")
    ?? metaContent(html, "twitter:title")
    ?? html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? normalizeMeaningfulText(title) : "";
}

function cleanSourceTitle(value: string, source: DiscoverySource) {
  if (source.domain === "rockstargames.com") return value.replace(/\s+-\s+Rockstar Games\s*$/i, "").trim();
  if (source.domain === "take2games.com") return value.replace(/\s+\|\s+Take-Two Interactive.*$/i, "").trim();
  return value;
}

function configuredStringArray(source: DiscoverySource, key: string) {
  const value = source.connectorConfig[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function usableDescription(value: string | undefined, ignoredFragments: string[]) {
  const normalized = value ? normalizeMeaningfulText(value) : "";
  if (normalized.length < 25) return undefined;
  if (ignoredFragments.some((fragment) => normalized.toLowerCase().includes(fragment.toLowerCase()))) return undefined;
  return normalized.slice(0, 1_000);
}

function firstRelevantParagraph(html: string, source: DiscoverySource, ignoredFragments: string[]) {
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const paragraph = usableDescription(match[1], ignoredFragments);
    if (!paragraph || paragraph.length > 1_500) continue;
    if (!passesConfiguredIncludeTerms(source, paragraph)) continue;
    return paragraph;
  }
  return undefined;
}

function canonicalFromHtml(html: string, finalUrl: string) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const values = attributes(match[0]);
    if ((values.get("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical") && values.get("href")) {
      return canonicalizeSourceUrl(values.get("href")!, finalUrl);
    }
  }
  return canonicalizeSourceUrl(finalUrl);
}

type JsonLdArticle = {
  headline?: string;
  name?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  url?: string;
  author?: string | { name?: string } | Array<{ name?: string }>;
  image?: string | string[] | { url?: string } | Array<{ url?: string }>;
  [key: string]: unknown;
};

function jsonLdArticles(html: string) {
  const articles: JsonLdArticle[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const type = Array.isArray(record["@type"]) ? record["@type"].join(" ") : String(record["@type"] ?? "");
    if (/\b(?:NewsArticle|Article|BlogPosting)\b/i.test(type)) articles.push(record as JsonLdArticle);
    if (record["@graph"]) visit(record["@graph"]);
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(decodeHtmlEntities(match[1])) as unknown);
    } catch {
      // Invalid structured data is ignored and the connector uses public page metadata instead.
    }
  }
  return articles;
}

function firstAuthor(value: JsonLdArticle["author"]) {
  if (typeof value === "string") return normalizeMeaningfulText(value);
  if (Array.isArray(value)) return value.map((entry) => entry?.name).find(Boolean);
  return value?.name;
}

function imageUrls(value: JsonLdArticle["image"]) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => typeof entry === "string" ? [entry] : entry?.url ? [entry.url] : []);
  }
  return value?.url ? [value.url] : [];
}

function parsedDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function timeDateFromHtml(html: string) {
  for (const match of html.matchAll(/<time\b[^>]*>/gi)) {
    const value = attributes(match[0]).get("datetime");
    const date = parsedDate(value);
    if (date) return date;
  }
  return undefined;
}

function visiblePublicationDate(value: string | undefined) {
  const match = value?.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!match) return undefined;
  return parsedDate(`${match[1]} ${match[2]}, ${match[3]} 00:00:00 UTC`);
}

function forceHttps(value: string) {
  const url = new URL(value);
  if (url.protocol === "http:") url.protocol = "https:";
  return canonicalizeSourceUrl(url.toString());
}

export function parseHtmlArticle(
  html: string,
  source: DiscoverySource,
  finalUrl: string,
  methodOverride?: ExtractionMethod,
): ConnectorItem | null {
  const structured = jsonLdArticles(html)[0];
  const ignoredFragments = configuredStringArray(source, "ignoredDescriptionFragments");
  const title = cleanSourceTitle(
    normalizeMeaningfulText(structured?.headline ?? structured?.name ?? pageTitle(html)),
    source,
  );
  const summary = usableDescription(structured?.description, ignoredFragments)
    ?? usableDescription(metaContent(html, "og:description"), ignoredFragments)
    ?? usableDescription(metaContent(html, "description"), ignoredFragments)
    ?? firstRelevantParagraph(html, source, ignoredFragments);
  if (!title || !passesConfiguredIncludeTerms(source, title, summary)) return null;
  const extractedCanonical = canonicalFromHtml(html, structured?.url ?? finalUrl);
  const canonicalUrl = forceHttps(discoveryUrlMatchesDomain(extractedCanonical, source.domain)
    ? extractedCanonical
    : canonicalizeSourceUrl(finalUrl));
  const publishedAt = parsedDate(structured?.datePublished
    ?? metaContent(html, "article:published_time"))
    ?? timeDateFromHtml(html)
    ?? visiblePublicationDate(summary);
  const author = firstAuthor(structured?.author) ?? metaContent(html, "author") ?? undefined;
  const media = [
    ...imageUrls(structured?.image),
    metaContent(html, "og:image"),
    metaContent(html, "twitter:image"),
  ].filter((value): value is string => Boolean(value)).slice(0, 5);
  const meaningful = [title, summary ?? "", publishedAt?.toISOString() ?? "", ...media].join("\n");
  const extractionMethod: ExtractionMethod = methodOverride ?? (structured ? "JSON_LD" : metaContent(html, "og:title") ? "OPEN_GRAPH" : "SSR_HTML");
  return {
    title,
    url: canonicalUrl,
    canonicalUrl,
    author,
    summary,
    publishedAt,
    sourceHash: sha256(canonicalUrl),
    contentHash: sha256(meaningful),
    changeType: classifyMeaningfulChange(meaningful),
    directEvidence: source.isFirstParty,
    metadata: {
      connector: "HTML_ARTICLE",
      extractionMethod,
      media,
      dateModified: structured?.dateModified ?? null,
    },
  };
}

export function parseHtmlListing(html: string, source: DiscoverySource, finalUrl: string): ConnectorItem[] {
  const config = connectorConfig(source, { linkPrefixes: [] as string[], maxItems: 20 });
  const prefixes = Array.isArray(config.linkPrefixes)
    ? config.linkPrefixes.filter((value): value is string => typeof value === "string" && value.startsWith("/"))
    : [];
  const maximumItems = typeof config.maxItems === "number" ? Math.max(1, Math.min(40, Math.floor(config.maxItems))) : 20;
  const seen = new Set<string>();
  const items: ConnectorItem[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = normalizeMeaningfulText(match[2]);
    if (title.length < 8 || title.length > 220 || !passesConfiguredIncludeTerms(source, title)) continue;
    const canonicalUrl = forceHttps(canonicalizeSourceUrl(decodeHtmlEntities(match[1]), finalUrl));
    if (!discoveryUrlMatchesDomain(canonicalUrl, source.domain)) continue;
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
      metadata: { connector: "HTML_LISTING", extractionMethod: "SSR_HTML" },
    });
    if (items.length >= maximumItems) break;
  }
  return items;
}

export class HtmlListingConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const response = await fetchSourceText(source, fetcher, { accept: "HTML" });
    const config = connectorConfig(source, {
      maxDetailItems: 5,
      followDetails: false,
      clientRenderedListing: false,
      requireItems: false,
      detailUrls: [] as string[],
    });
    const listingItems = parseHtmlListing(response.text, source, response.finalUrl);
    const configuredUrls = Array.isArray(config.detailUrls)
      ? config.detailUrls.filter((value): value is string => typeof value === "string")
      : [];
    const shouldFetchDetails = Boolean(config.followDetails) || configuredUrls.length > 0;
    const maximumDetails = typeof config.maxDetailItems === "number"
      ? Math.max(1, Math.min(10, Math.floor(config.maxDetailItems)))
      : 5;
    const detailUrls = [...new Set([...listingItems.map((item) => item.canonicalUrl ?? item.url), ...configuredUrls])]
      .slice(0, maximumDetails);
    const warnings: string[] = [];
    const detailItems: ConnectorItem[] = [];
    let requestCount = response.requestCount;
    let responseBytes = response.responseBytes;
    const responseHashes = [response.responseHash];
    let lastHttpStatus = response.httpStatus;

    if (Boolean(config.clientRenderedListing) && listingItems.length === 0) {
      warnings.push("The public listing response did not contain server-rendered article links; configured public article metadata was used as a fallback.");
    }
    if (shouldFetchDetails) {
      for (const detailUrl of detailUrls) {
        try {
          const detail = await fetchSourceText(source, fetcher, { url: detailUrl, accept: "HTML" });
          requestCount += detail.requestCount;
          responseBytes += detail.responseBytes;
          responseHashes.push(detail.responseHash);
          lastHttpStatus = detail.httpStatus;
          const method = configuredUrls.includes(detailUrl) && listingItems.length === 0 ? "KNOWN_ARTICLE_METADATA" as const : undefined;
          const item = parseHtmlArticle(detail.text, source, detail.finalUrl, method);
          if (item) detailItems.push(item);
          else warnings.push(`No relevant article metadata was extracted from ${detail.finalUrl}.`);
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "A public detail page could not be fetched.");
        }
      }
    }

    const items = shouldFetchDetails ? detailItems : listingItems;
    const extractionSucceeded = items.length > 0 || !Boolean(config.requireItems);
    const health = !extractionSucceeded ? "FAILED" : warnings.length ? "DEGRADED" : "HEALTHY";
    const extractionMethod = items[0]?.metadata.extractionMethod as ExtractionMethod | undefined
      ?? (listingItems.length ? "SSR_HTML" : "NONE");
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: lastHttpStatus,
      responseBytes,
      responseHash: sha256(responseHashes.join("\n")),
      requestCount,
      items,
      extractionMethod,
      extractionSucceeded,
      health,
      lastContentHash: items[0]?.contentHash,
      warnings: !extractionSucceeded && warnings.length === 0
        ? ["The connector fetched the source but could not extract any required relevant items."]
        : warnings,
    };
  }
}

export class HtmlChangeConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const response = await fetchSourceText(source, fetcher, { accept: "HTML" });
    const parsed = parseHtmlArticle(response.text, source, response.finalUrl);
    const normalizedText = normalizeMeaningfulText(response.text).slice(0, 100_000);
    const canonicalUrl = canonicalFromHtml(response.text, response.finalUrl);
    const item: ConnectorItem = parsed ?? {
      title: pageTitle(response.text) || source.name,
      url: canonicalUrl,
      canonicalUrl,
      summary: usableDescription(metaContent(response.text, "description"), []),
      sourceHash: sha256(canonicalUrl),
      contentHash: sha256(normalizedText),
      changeType: classifyMeaningfulChange(normalizedText),
      directEvidence: source.isFirstParty,
      metadata: { connector: "HTML_CHANGE", extractionMethod: "SSR_HTML", normalizedCharacterCount: normalizedText.length },
    };
    const extractionSucceeded = normalizedText.length >= 25;
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: response.httpStatus,
      responseBytes: response.responseBytes,
      responseHash: response.responseHash,
      requestCount: response.requestCount,
      items: extractionSucceeded ? [item] : [],
      extractionMethod: (item.metadata.extractionMethod as ExtractionMethod | undefined) ?? "SSR_HTML",
      extractionSucceeded,
      health: extractionSucceeded ? "HEALTHY" : "FAILED",
      lastContentHash: extractionSucceeded ? item.contentHash : undefined,
      warnings: extractionSucceeded ? [] : ["The public page did not expose enough stable text or metadata to monitor safely."],
    };
  }
}
