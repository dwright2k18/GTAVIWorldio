import { classifyMeaningfulChange } from "../change-detection";
import { canonicalizeSourceUrl, decodeHtmlEntities, normalizeMeaningfulText, sha256 } from "../normalize";
import { discoveryUrlMatchesDomain } from "../safety";
import type { ConnectorItem, ConnectorResult, DiscoverySource, ExtractionMethod, SourceHttpCacheEntry } from "../types";
import {
  connectorConfig,
  emptyConnectorMetrics,
  fetchSourceText,
  passesConfiguredIncludeTerms,
  sourceHttpCacheEntry,
  type DiscoveryFetcher,
  type SourceConnector,
} from "./base";
import {
  DEFAULT_DETAIL_REFRESH_MINUTES,
  detailRefreshDue,
  knownSourceUrls,
  seedKnownCacheEntry,
} from "./cache-policy";

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

export function extractRockstarNewswireUrls(html: string, baseUrl: string) {
  const values: string[] = [];
  const decoded = decodeHtmlEntities(html).replaceAll("\\/", "/");
  for (const match of decoded.matchAll(/(?:https:\/\/(?:www\.)?rockstargames\.com)?\/newswire\/article\/[a-z0-9/_-]+/gi)) {
    try {
      const canonical = forceHttps(canonicalizeSourceUrl(match[0], baseUrl));
      const host = new URL(canonical).hostname.toLowerCase();
      if (host === "rockstargames.com" || host === "www.rockstargames.com") values.push(canonical);
    } catch {
      // Malformed embedded URLs are ignored; no alternate host is followed.
    }
  }
  return [...new Set(values)].sort();
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
  const referencedOfficialUrls = extractRockstarNewswireUrls(html, finalUrl)
    .filter((url) => url !== canonicalUrl);
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
      referencedOfficialUrls,
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

function configuredRefreshMinutes(value: unknown) {
  return typeof value === "number"
    ? Math.max(60, Math.floor(value))
    : DEFAULT_DETAIL_REFRESH_MINUTES;
}

function stableListingHash(items: ConnectorItem[], configuredUrls: string[]) {
  return sha256(
    [...items.map((item) => `${item.canonicalUrl ?? item.url}\n${item.contentHash}`), ...configuredUrls]
      .sort()
      .join("\n"),
  );
}

function relevantPageReferences(html: string, finalUrl: string, source: DiscoverySource) {
  const references = new Set<string>();
  for (const match of html.matchAll(/(?:href|src)=["']([^"'#]+)["']/gi)) {
    try {
      const url = forceHttps(canonicalizeSourceUrl(decodeHtmlEntities(match[1]), finalUrl));
      if (!discoveryUrlMatchesDomain(url, source.domain)) continue;
      if (!/\b(?:media|video|trailer|screenshot|artwork|download|preorder)\b/i.test(new URL(url).pathname)) continue;
      references.add(url);
    } catch {
      // Invalid or off-domain references are excluded from the semantic page signature.
    }
  }
  return [...references].sort().slice(0, 250);
}

function detailUrlAllowed(source: DiscoverySource, url: string, prefixes: string[], configuredUrls: string[]) {
  try {
    const canonical = canonicalizeSourceUrl(url);
    if (!discoveryUrlMatchesDomain(canonical, source.domain)) return false;
    if (configuredUrls.includes(canonical)) return true;
    const pathname = new URL(canonical).pathname;
    return prefixes.length === 0 || prefixes.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

function cacheHealth(source: DiscoverySource) {
  return source.healthStatus === "DEGRADED" ? "DEGRADED" as const : "HEALTHY" as const;
}

function mergeCacheEntry(
  entries: Record<string, SourceHttpCacheEntry>,
  key: string,
  update: SourceHttpCacheEntry,
) {
  entries[key] = { ...entries[key], ...update };
}

export class HtmlListingConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const config = connectorConfig(source, {
      maxDetailItems: 3,
      followDetails: false,
      clientRenderedListing: false,
      requireItems: false,
      detailUrls: [] as string[],
      linkPrefixes: [] as string[],
      detailRefreshMinutes: DEFAULT_DETAIL_REFRESH_MINUTES,
    });
    const rootCache = sourceHttpCacheEntry(source, source.url);
    const response = await fetchSourceText(source, fetcher, {
      accept: "HTML",
      cache: rootCache,
    });
    const cacheUpdates: Record<string, SourceHttpCacheEntry> = {
      [response.cacheKey]: response.cacheUpdate,
    };
    const metrics = emptyConnectorMetrics({
      listingRequests: response.requestCount,
      conditionalRequests: response.conditionalRequest ? response.requestCount : 0,
      notModifiedResponses: response.notModified ? 1 : 0,
    });
    const listingItems = response.notModified
      ? []
      : parseHtmlListing(response.text, source, response.finalUrl);
    const configuredUrls = Array.isArray(config.detailUrls)
      ? config.detailUrls.flatMap((value): string[] => {
          if (typeof value !== "string") return [];
          try {
            return [canonicalizeSourceUrl(value, response.finalUrl)];
          } catch {
            return [];
          }
        })
      : [];
    const prefixes = Array.isArray(config.linkPrefixes)
      ? config.linkPrefixes.filter((value): value is string => typeof value === "string")
      : [];
    const shouldFetchDetails = Boolean(config.followDetails) || configuredUrls.length > 0;
    const maximumDetails = typeof config.maxDetailItems === "number"
      ? Math.max(1, Math.min(3, Math.floor(config.maxDetailItems)))
      : 3;
    const refreshMinutes = configuredRefreshMinutes(config.detailRefreshMinutes);
    const knownUrls = knownSourceUrls(source);
    const rootUrl = canonicalizeSourceUrl(source.url);
    const cachedDetailUrls = Object.keys(source.httpCache ?? {}).filter((url) =>
      canonicalizeSourceUrl(url) !== rootUrl
      && detailUrlAllowed(source, url, prefixes, configuredUrls));
    const knownDetailUrls = [...knownUrls].filter((url) =>
      canonicalizeSourceUrl(url) !== rootUrl
      && detailUrlAllowed(source, url, prefixes, configuredUrls));
    const candidateDetailUrls = [...new Set([
      ...listingItems.map((item) => item.canonicalUrl ?? item.url),
      ...configuredUrls,
      ...cachedDetailUrls,
      ...knownDetailUrls,
    ].map((url) => canonicalizeSourceUrl(url)))];
    const listingHash = response.notModified
      ? rootCache?.listingHash
      : stableListingHash(listingItems, configuredUrls);
    const listingChanged = response.notModified
      ? false
      : rootCache?.listingHash
        ? rootCache.listingHash !== listingHash
        : !source.lastContentHash
          || (listingItems[0]?.contentHash ?? response.responseHash) !== source.lastContentHash;
    mergeCacheEntry(cacheUpdates, response.cacheKey, {
      ...(listingHash ? { listingHash, semanticHash: listingHash } : {}),
    });

    const listingItemsByUrl = new Map(
      listingItems.map((item) => [canonicalizeSourceUrl(item.canonicalUrl ?? item.url), item]),
    );
    const prioritizedDetails: Array<{ url: string; priority: number }> = [];
    for (const detailUrl of candidateDetailUrls) {
      const existing = seedKnownCacheEntry(source, detailUrl);
      const listingItem = listingItemsByUrl.get(detailUrl);
      const isKnown = knownUrls.has(detailUrl) || Boolean(source.httpCache?.[detailUrl]);
      const listingMetadataChanged = Boolean(
        listingItem && existing.listingHash && existing.listingHash !== listingItem.contentHash,
      );
      const due = detailRefreshDue({
        cache: existing,
        fallbackCheckedAt: source.lastSuccessfulFetchAt,
        refreshMinutes,
      });
      mergeCacheEntry(cacheUpdates, detailUrl, {
        ...existing,
        ...(listingItem ? { listingHash: listingItem.contentHash } : {}),
      });
      if (!shouldFetchDetails) continue;
      if (!isKnown || listingMetadataChanged) prioritizedDetails.push({ url: detailUrl, priority: 0 });
      else if (due) prioritizedDetails.push({ url: detailUrl, priority: 1 });
      else metrics.knownUrlSkips += 1;
    }
    prioritizedDetails.sort((left, right) => left.priority - right.priority || left.url.localeCompare(right.url));
    const detailUrls = prioritizedDetails.slice(0, maximumDetails).map(({ url }) => url);
    metrics.detailFetchesDeferred = Math.max(0, prioritizedDetails.length - detailUrls.length);
    metrics.detailFetchesAvoided = shouldFetchDetails
      ? Math.max(0, candidateDetailUrls.length - detailUrls.length)
      : 0;
    metrics.requestsSaved = metrics.detailFetchesAvoided;
    const warnings: string[] = [];
    const detailItems: ConnectorItem[] = [];
    let requestCount = response.requestCount;
    let responseBytes = response.responseBytes;
    const responseHashes = [response.responseHash];
    let lastHttpStatus = response.httpStatus;
    let successfulResponses = 1;

    if (Boolean(config.clientRenderedListing) && listingItems.length === 0) {
      warnings.push("The public listing response did not contain server-rendered article links; configured public article metadata was used as a fallback.");
    }
    if (shouldFetchDetails) {
      for (const detailUrl of detailUrls) {
        try {
          const detail = await fetchSourceText(source, fetcher, {
            url: detailUrl,
            accept: "HTML",
            cache: cacheUpdates[detailUrl] ?? sourceHttpCacheEntry(source, detailUrl),
          });
          requestCount += detail.requestCount;
          metrics.detailRequests += detail.requestCount;
          if (detail.conditionalRequest) metrics.conditionalRequests += detail.requestCount;
          if (detail.notModified) metrics.notModifiedResponses += 1;
          responseBytes += detail.responseBytes;
          responseHashes.push(detail.responseHash);
          lastHttpStatus = detail.httpStatus;
          successfulResponses += 1;
          mergeCacheEntry(cacheUpdates, detail.cacheKey, detail.cacheUpdate);
          if (detail.notModified) continue;
          const method = configuredUrls.includes(detailUrl) && listingItems.length === 0 ? "KNOWN_ARTICLE_METADATA" as const : undefined;
          const item = parseHtmlArticle(detail.text, source, detail.finalUrl, method);
          if (item) detailItems.push(item);
          else warnings.push(`No relevant article metadata was extracted from ${detail.finalUrl}.`);
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "A public detail page could not be fetched.");
        }
      }
    }

    const items = shouldFetchDetails
      ? detailItems
      : listingChanged && !response.notModified ? listingItems : [];
    const unchangedOrKnown = response.notModified
      || !listingChanged
      || (candidateDetailUrls.length > 0 && candidateDetailUrls.every((url) => knownUrls.has(url)));
    if (unchangedOrKnown && items.length === 0) metrics.hashUnchangedExits += 1;
    const extractionSucceeded = items.length > 0 || unchangedOrKnown || !Boolean(config.requireItems);
    const health = !extractionSucceeded
      ? "FAILED"
      : warnings.length || cacheHealth(source) === "DEGRADED" ? "DEGRADED" : "HEALTHY";
    const extractionMethod = items[0]?.metadata.extractionMethod as ExtractionMethod | undefined
      ?? (listingItems.length ? "SSR_HTML" : "NONE");
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: lastHttpStatus,
      responseBytes,
      responseHash: sha256(responseHashes.join("\n")),
      requestCount,
      successfulResponses,
      successfulExtractions: items.length,
      items,
      extractionMethod,
      extractionSucceeded,
      health,
      lastContentHash: listingHash ?? source.lastContentHash ?? undefined,
      warnings: !extractionSucceeded && warnings.length === 0
        ? ["The connector fetched the source but could not extract any required relevant items."]
        : warnings,
      cacheUpdates,
      metrics,
    };
  }
}

export class HtmlChangeConnector implements SourceConnector {
  async fetch(source: DiscoverySource, fetcher?: DiscoveryFetcher): Promise<ConnectorResult> {
    const config = connectorConfig(source, {
      discoverOfficialArticleLinks: false,
      maxDetailItems: 3,
      detailRefreshMinutes: DEFAULT_DETAIL_REFRESH_MINUTES,
    });
    const rootCache = sourceHttpCacheEntry(source, source.url);
    const response = await fetchSourceText(source, fetcher, {
      accept: "HTML",
      cache: rootCache,
    });
    const cacheUpdates: Record<string, SourceHttpCacheEntry> = {
      [response.cacheKey]: response.cacheUpdate,
    };
    const metrics = emptyConnectorMetrics({
      listingRequests: response.requestCount,
      conditionalRequests: response.conditionalRequest ? response.requestCount : 0,
      notModifiedResponses: response.notModified ? 1 : 0,
    });
    const normalizedText = response.notModified
      ? ""
      : normalizeMeaningfulText(response.text).slice(0, 100_000);
    const canonicalUrl = response.notModified
      ? canonicalizeSourceUrl(response.finalUrl)
      : canonicalFromHtml(response.text, response.finalUrl);
    const parsed = response.notModified
      ? null
      : parseHtmlArticle(response.text, source, response.finalUrl);
    const item: ConnectorItem | null = response.notModified ? null : parsed ?? {
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
    const discoveredOfficialUrls = response.notModified
      ? []
      : extractRockstarNewswireUrls(response.text, response.finalUrl);
    const semanticHash = response.notModified
      ? rootCache?.semanticHash
      : sha256([
          item?.contentHash ?? sha256(normalizedText),
          ...relevantPageReferences(response.text, response.finalUrl, source),
          ...discoveredOfficialUrls,
        ].join("\n"));
    const rootChanged = response.notModified
      ? false
      : rootCache?.semanticHash
        ? rootCache.semanticHash !== semanticHash
        : !source.lastContentHash || source.lastContentHash !== item?.contentHash;
    mergeCacheEntry(cacheUpdates, response.cacheKey, {
      ...(semanticHash ? { semanticHash } : {}),
    });
    const detailItems: ConnectorItem[] = [];
    const unresolvedOfficialUrls: string[] = [];
    const warnings: string[] = [];
    let requestCount = response.requestCount;
    let responseBytes = response.responseBytes;
    const responseHashes = [response.responseHash];
    let lastHttpStatus = response.httpStatus;
    let successfulResponses = 1;
    if (Boolean(config.discoverOfficialArticleLinks) && source.domain === "rockstargames.com") {
      const maximumDetails = typeof config.maxDetailItems === "number"
        ? Math.max(1, Math.min(3, Math.floor(config.maxDetailItems)))
        : 3;
      const refreshMinutes = configuredRefreshMinutes(config.detailRefreshMinutes);
      const knownUrls = knownSourceUrls(source);
      const cachedOfficialUrls = Object.keys(source.httpCache ?? {}).filter((url) => {
        try {
          return /\/newswire\/article\//i.test(new URL(url).pathname);
        } catch {
          return false;
        }
      });
      const knownOfficialUrls = [...knownUrls].filter((url) => {
        try {
          return /\/newswire\/article\//i.test(new URL(url).pathname);
        } catch {
          return false;
        }
      });
      const candidateDetailUrls = [...new Set([
        ...discoveredOfficialUrls,
        ...cachedOfficialUrls,
        ...knownOfficialUrls,
      ].map((url) => canonicalizeSourceUrl(url)))].filter((url) =>
        canonicalizeSourceUrl(url) !== canonicalizeSourceUrl(item?.canonicalUrl ?? item?.url ?? source.url));
      const prioritizedDetails: Array<{ url: string; priority: number }> = [];
      for (const detailUrl of candidateDetailUrls) {
        const existing = seedKnownCacheEntry(source, detailUrl);
        const isKnown = knownUrls.has(detailUrl) || Boolean(source.httpCache?.[detailUrl]);
        const due = detailRefreshDue({
          cache: existing,
          fallbackCheckedAt: source.lastSuccessfulFetchAt,
          refreshMinutes,
        });
        mergeCacheEntry(cacheUpdates, detailUrl, {
          ...existing,
          listingHash: sha256(detailUrl),
        });
        if (!isKnown) prioritizedDetails.push({ url: detailUrl, priority: 0 });
        else if (due) prioritizedDetails.push({ url: detailUrl, priority: 1 });
        else metrics.knownUrlSkips += 1;
      }
      prioritizedDetails.sort((left, right) => left.priority - right.priority || left.url.localeCompare(right.url));
      const detailUrls = prioritizedDetails.slice(0, maximumDetails).map(({ url }) => url);
      metrics.detailFetchesDeferred = Math.max(0, prioritizedDetails.length - detailUrls.length);
      metrics.detailFetchesAvoided = Math.max(0, candidateDetailUrls.length - detailUrls.length);
      metrics.requestsSaved = metrics.detailFetchesAvoided;
      for (const detailUrl of detailUrls) {
        try {
          const detail = await fetchSourceText(source, fetcher, {
            url: detailUrl,
            accept: "HTML",
            cache: cacheUpdates[detailUrl] ?? sourceHttpCacheEntry(source, detailUrl),
          });
          requestCount += detail.requestCount;
          metrics.detailRequests += detail.requestCount;
          if (detail.conditionalRequest) metrics.conditionalRequests += detail.requestCount;
          if (detail.notModified) metrics.notModifiedResponses += 1;
          responseBytes += detail.responseBytes;
          responseHashes.push(detail.responseHash);
          lastHttpStatus = detail.httpStatus;
          successfulResponses += 1;
          mergeCacheEntry(cacheUpdates, detail.cacheKey, detail.cacheUpdate);
          if (detail.notModified) continue;
          const parsedDetail = parseHtmlArticle(detail.text, source, detail.finalUrl);
          if (parsedDetail) detailItems.push(parsedDetail);
          else unresolvedOfficialUrls.push(detailUrl);
        } catch (error) {
          unresolvedOfficialUrls.push(detailUrl);
          warnings.push(error instanceof Error ? error.message : "An official Rockstar reference could not be resolved.");
        }
      }
    }
    if (item) {
      item.metadata = {
        ...item.metadata,
        referencedOfficialUrls: discoveredOfficialUrls,
        unresolvedOfficialUrls,
      };
    }
    const extractionSucceeded = response.notModified || normalizedText.length >= 25;
    const items = extractionSucceeded
      ? [...(rootChanged && item ? [item] : []), ...detailItems]
      : [];
    if (!rootChanged && detailItems.length === 0) metrics.hashUnchangedExits += 1;
    return {
      sourceUrl: response.finalUrl,
      fetchedAt: new Date(),
      httpStatus: lastHttpStatus,
      responseBytes,
      responseHash: sha256(responseHashes.join("\n")),
      requestCount,
      successfulResponses,
      successfulExtractions: items.length,
      items,
      extractionMethod: (item?.metadata.extractionMethod as ExtractionMethod | undefined)
        ?? (source.lastExtractionMethod as ExtractionMethod | null | undefined)
        ?? "SSR_HTML",
      extractionSucceeded,
      health: extractionSucceeded
        ? unresolvedOfficialUrls.length ? "DEGRADED" : cacheHealth(source)
        : "FAILED",
      lastContentHash: extractionSucceeded
        ? item?.contentHash ?? source.lastContentHash ?? undefined
        : undefined,
      warnings: extractionSucceeded
        ? warnings
        : ["The public page did not expose enough stable text or metadata to monitor safely."],
      cacheUpdates,
      metrics,
    };
  }
}
