import { describe, expect, it, vi } from "vitest";

import { classifyMeaningfulChange, meaningfulContentHash } from "@/lib/discovery/change-detection";
import { shouldCreateCandidateForSnapshot } from "@/lib/discovery/baseline";
import { parseFeedItems } from "@/lib/discovery/connectors/feeds";
import { HtmlListingConnector, parseHtmlArticle, parseHtmlListing } from "@/lib/discovery/connectors/html";
import { fetchSourceText } from "@/lib/discovery/connectors/base";
import { canUseDeepResearch, estimatedMonthlyRequests } from "@/lib/discovery/cost";
import { assessDuplicate, clusterEventKey } from "@/lib/discovery/deduplication";
import { canonicalizeSourceUrl, jaccardSimilarity, normalizeHeadline, sha256 } from "@/lib/discovery/normalize";
import { buildSafeResearchPacket } from "@/lib/discovery/research";
import { discoverySnapshotExpiry } from "@/lib/discovery/retention-policy";
import { assertSafeDiscoveryUrl, classifyMediaRights, discoveryUrlMatchesDomain } from "@/lib/discovery/safety";
import { scoreCandidate } from "@/lib/discovery/scoring";
import { recommendVerification } from "@/lib/discovery/verification";
import type { ConnectorItem, DiscoverySource } from "@/lib/discovery/types";

const officialSource: DiscoverySource = {
  id: "41000000-0000-4000-8000-000000000001",
  name: "Rockstar Games",
  url: "https://www.rockstargames.com/newswire?tag_id=722",
  domain: "rockstargames.com",
  sourceType: "FIRST_PARTY",
  authorityTier: "TIER_1",
  isFirstParty: true,
  reliabilityScore: 100,
  connectorKind: "HTML_LISTING",
  connectorConfig: { linkPrefixes: ["/newswire/article/"], maxItems: 5 },
  rateLimitPerHour: 4,
  minCheckIntervalMinutes: 30,
  termsPolicyNotes: "Metadata only.",
};

const item: ConnectorItem = {
  title: "Rockstar confirms a new GTA VI trailer",
  url: "https://www.rockstargames.com/newswire/article/example",
  canonicalUrl: "https://www.rockstargames.com/newswire/article/example",
  summary: "Rockstar announced that a new GTA VI trailer will premiere this week.",
  publishedAt: new Date(),
  sourceHash: sha256("official-example"),
  contentHash: sha256("official-example-content"),
  changeType: "TRAILER_ADDED",
  directEvidence: true,
  metadata: {},
};

describe("discovery normalization", () => {
  it("removes tracking parameters and normalizes GTA naming", () => {
    expect(canonicalizeSourceUrl("https://example.com/story/?utm_source=test&b=2&a=1#top")).toBe("https://example.com/story?a=1&b=2");
    expect(normalizeHeadline("Grand Theft Auto 6: Trailer Details!")).toBe("gta vi trailer details");
  });

  it("calculates semantic overlap and stable cluster keys", () => {
    expect(jaccardSimilarity("GTA 6 release date confirmed", "Rockstar confirms GTA VI release date")).toBeGreaterThanOrEqual(0.5);
    expect(clusterEventKey("Rockstar confirms GTA VI release date")).toContain("release");
  });
});

describe("source connectors", () => {
  it("parses RSS metadata without retaining full articles", () => {
    const xml = `<rss><channel><item><title>GTA VI update</title><link>https://www.rockstargames.com/story?utm_source=rss</link><description>Short sourced summary.</description><pubDate>Wed, 20 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>`;
    const parsed = parseFeedItems(xml, officialSource, officialSource.url);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].canonicalUrl).toBe("https://www.rockstargames.com/story");
    expect(parsed[0].summary).toBe("Short sourced summary.");
  });

  it("extracts official Atom media descriptions and stable video metadata", () => {
    const youtube = {
      ...officialSource,
      url: "https://www.youtube.com/feeds/videos.xml?channel_id=official",
      domain: "youtube.com",
      connectorKind: "ATOM" as const,
    };
    const xml = `<feed><entry><yt:videoId>abc123</yt:videoId><title>Grand Theft Auto VI: An Extended Look Coming August 27</title><link href="https://www.youtube.com/watch?v=abc123"/><published>2026-08-06T12:00:25Z</published><media:group><media:description>Grand Theft Auto VI: An Extended Look will premiere on August 27.</media:description><media:thumbnail url="https://i.ytimg.com/vi/abc123/hqdefault.jpg"/></media:group></entry></feed>`;
    const parsed = parseFeedItems(xml, youtube, youtube.url);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].summary).toContain("premiere on August 27");
    expect(parsed[0].metadata).toMatchObject({ extractionMethod: "OFFICIAL_VIDEO_FEED", videoId: "abc123" });
  });

  it("limits HTML listing extraction to configured paths", () => {
    const html = `<a href="/newswire/article/allowed">Official GTA VI update</a><a href="/support/private">Ignore this support link</a>`;
    const parsed = parseHtmlListing(html, officialSource, officialSource.url);
    expect(parsed.map((entry) => entry.title)).toEqual(["Official GTA VI update"]);
  });

  it("prefers JSON-LD and public article metadata over generic page copy", () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/approved.jpg"><script type="application/ld+json">{"@type":"NewsArticle","headline":"Grand Theft Auto VI pre-orders open","description":"Rockstar Games confirms public pre-orders for Grand Theft Auto VI.","datePublished":"2026-06-24T10:00:00Z","author":{"name":"Rockstar Games"},"url":"https://www.rockstargames.com/newswire/article/preorders"}</script></head></html>`;
    const parsed = parseHtmlArticle(html, officialSource, officialSource.url);
    expect(parsed).not.toBeNull();
    expect(parsed?.publishedAt?.toISOString()).toBe("2026-06-24T10:00:00.000Z");
    expect(parsed?.metadata).toMatchObject({ extractionMethod: "JSON_LD" });
  });

  it("does not treat rendering-script churn as a meaningful article change", () => {
    const common = `<head><meta property="og:title" content="Grand Theft Auto VI official update"><meta property="og:description" content="Rockstar confirms the same public GTA VI details."><link rel="canonical" href="https://www.rockstargames.com/newswire/article/stable"></head>`;
    const left = parseHtmlArticle(`<html>${common}<body><script>build='one'</script></body></html>`, officialSource, officialSource.url);
    const right = parseHtmlArticle(`<html>${common}<body><script>build='two'</script></body></html>`, officialSource, officialSource.url);
    expect(left?.contentHash).toBe(right?.contentHash);
  });

  it("normalizes legacy official canonicals to HTTPS and extracts visible release dates", () => {
    const takeTwo = { ...officialSource, domain: "take2games.com", url: "https://www.take2games.com/ir/press-releases" };
    const html = `<head><meta property="og:title" content="Rockstar Games Announces Pre-Orders for Grand Theft Auto VI | Take-Two Interactive Software, Inc."><link rel="canonical" href="http://www.take2games.com/ir/news/preorders"></head><body><p>NEW YORK --(BUSINESS WIRE)--Jun. 24, 2026-- Rockstar Games confirms pre-orders for Grand Theft Auto VI.</p></body>`;
    const parsed = parseHtmlArticle(html, takeTwo, takeTwo.url);
    expect(parsed?.canonicalUrl).toBe("https://www.take2games.com/ir/news/preorders");
    expect(parsed?.title).toBe("Rockstar Games Announces Pre-Orders for Grand Theft Auto VI");
    expect(parsed?.publishedAt?.toISOString()).toBe("2026-06-24T00:00:00.000Z");
  });

  it("reports a client-rendered listing fallback as degraded instead of silently healthy", async () => {
    const source = {
      ...officialSource,
      connectorConfig: {
        ...officialSource.connectorConfig,
        clientRenderedListing: true,
        requireItems: true,
        detailUrls: ["https://www.rockstargames.com/newswire/article/extended-look"],
      },
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("<html><body><div id='root'></div></body></html>", { status: 200, headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response("<html><head><meta property='og:title' content='Grand Theft Auto VI: An Extended Look'><meta property='og:description' content='Grand Theft Auto VI official presentation details.'><link rel='canonical' href='https://www.rockstargames.com/newswire/article/extended-look'></head></html>", { status: 200, headers: { "content-type": "text/html" } }));
    const result = await new HtmlListingConnector().fetch(source, fetcher as typeof fetch);
    expect(result.health).toBe("DEGRADED");
    expect(result.extractionMethod).toBe("KNOWN_ARTICLE_METADATA");
    expect(result.items).toHaveLength(1);
    expect(result.requestCount).toBe(2);
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Accept: expect.stringContaining("text/html") });
  });

  it("marks required empty extraction as failed", async () => {
    const source = { ...officialSource, connectorConfig: { ...officialSource.connectorConfig, requireItems: true } };
    const fetcher = vi.fn().mockResolvedValue(new Response("<html><body>No relevant links</body></html>", { status: 200 }));
    const result = await new HtmlListingConnector().fetch(source, fetcher as typeof fetch);
    expect(result.extractionSucceeded).toBe(false);
    expect(result.health).toBe("FAILED");
  });

  it("retries one transient gateway failure and then stops", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "content-type": "text/html" } }));
    const result = await fetchSourceText(officialSource, fetcher as typeof fetch);
    expect(result.text).toBe("ok");
    expect(result.requestCount).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects a redirect to a private target before following it", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } }));
    await expect(fetchSourceText(officialSource, fetcher as typeof fetch)).rejects.toThrow(/Private/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a public redirect that leaves the monitored source domain", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://example.com/copied-feed" } }));
    await expect(fetchSourceText(officialSource, fetcher as typeof fetch)).rejects.toThrow(/domain/);
  });
});

describe("verification and scoring", () => {
  it("only recommends confirmed for direct first-party evidence", () => {
    expect(recommendVerification(officialSource, { directEvidence: true, title: item.title })).toBe("CONFIRMED");
    expect(recommendVerification({ ...officialSource, authorityTier: "TIER_2", isFirstParty: false }, { directEvidence: false, title: item.title })).toBe("CREDIBLE_REPORT");
    expect(recommendVerification({ ...officialSource, authorityTier: "TIER_4", isFirstParty: false }, { directEvidence: false, title: "Alleged GTA VI leak" })).toBe("ALLEGED_LEAK");
  });

  it("keeps confidence separate from newsworthiness and produces useful opportunities", () => {
    const scored = scoreCandidate(officialSource, item, { independentSourceCount: 1, publicationMentions: 2, repeatedQuestions: 3, isNovel: true });
    expect(scored.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(scored.newsworthinessScore).toBeGreaterThanOrEqual(75);
    expect(scored.evergreen.path).toBe("/trailers");
    expect(scored.quickHitScore).toBeGreaterThan(0);
    expect(scored.primaryVideoScore).toBeGreaterThan(0);
  });

  it("uses INSUFFICIENT EVIDENCE rather than filling gaps", () => {
    const scored = scoreCandidate(officialSource, { ...item, summary: undefined });
    const packet = buildSafeResearchPacket(scored);
    expect(packet.summary).toBe("INSUFFICIENT EVIDENCE");
    expect(packet.aiStatus).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("deduplication and change detection", () => {
  it("baselines existing connector content before creating candidates", () => {
    expect(shouldCreateCandidateForSnapshot({ connectorKind: "HTML_LISTING", isInitialBaseline: true, wasPreviouslySeen: false })).toBe(false);
    expect(shouldCreateCandidateForSnapshot({ connectorKind: "HTML_LISTING", isInitialBaseline: false, wasPreviouslySeen: true })).toBe(false);
    expect(shouldCreateCandidateForSnapshot({ connectorKind: "HTML_LISTING", isInitialBaseline: false, wasPreviouslySeen: false })).toBe(true);
    expect(shouldCreateCandidateForSnapshot({ connectorKind: "MANUAL", isInitialBaseline: true, wasPreviouslySeen: false })).toBe(true);
  });

  it("detects exact and likely duplicates", () => {
    const existing = [{ id: "one", canonicalUrl: item.url, normalizedTitle: normalizeHeadline(item.title), contentHash: item.contentHash, sourcePublishedAt: new Date() }];
    expect(assessDuplicate({ canonicalUrl: `${item.url}?utm_source=test`, title: item.title, contentHash: item.contentHash, publishedAt: new Date() }, existing).status).toBe("DUPLICATE");
    expect(assessDuplicate({ canonicalUrl: `${item.url}?utm_source=test`, title: item.title, contentHash: "changed-content", publishedAt: new Date() }, existing).status).toBe("RELATED");
    expect(assessDuplicate({ canonicalUrl: "https://example.com/another", title: "Rockstar confirms new GTA 6 trailer", contentHash: "new-hash", publishedAt: new Date() }, existing).status).toBe("LIKELY_DUPLICATE");
  });

  it("classifies high-value official page changes", () => {
    expect(classifyMeaningfulChange("Grand Theft Auto VI release date delayed until November")).toBe("RELEASE_DATE_CHANGE");
    expect(classifyMeaningfulChange("Pre-order pricing is now available for $80")).toBe("PRICE_CHANGE");
    expect(meaningfulContentHash("<style>x</style><main>Release date</main>")).toBe(meaningfulContentHash("<main>Release date</main>"));
  });
});

describe("safety and cost controls", () => {
  it("rejects private targets, credentials, insecure URLs, and archive payloads", () => {
    expect(() => assertSafeDiscoveryUrl("http://example.com/story")).toThrow(/HTTPS/);
    expect(() => assertSafeDiscoveryUrl("https://127.0.0.1/private")).toThrow(/Private/);
    expect(() => assertSafeDiscoveryUrl("https://user:pass@example.com/story")).toThrow(/credentials/);
    expect(() => assertSafeDiscoveryUrl("https://example.com/leaked-build.zip")).toThrow(/Binary/);
    expect(discoveryUrlMatchesDomain("https://news.example.com/story", "example.com")).toBe(true);
    expect(discoveryUrlMatchesDomain("https://example.com.attacker.invalid/story", "example.com")).toBe(false);
  });

  it("marks alleged-leak media as do not host", () => {
    expect(classifyMediaRights({ isFirstParty: false, authorityTier: "TIER_4", sourceUrl: "https://example.com/post" })).toBe("DO_NOT_HOST");
  });

  it("keeps paid AI disabled under the free starting limits", () => {
    expect(canUseDeepResearch({ enabled: true, callsToday: 0, dailyLimit: 0, estimatedMonthlyCostCents: 0, monthlyLimitCents: 0 })).toBe(false);
    expect(estimatedMonthlyRequests({ activeTier1: 4, activeTier2: 3, activeTier3: 1 })).toBeLessThanOrEqual(3000);
  });

  it("bounds temporary snapshot retention", () => {
    const start = new Date("2026-08-21T00:00:00.000Z");
    expect(discoverySnapshotExpiry(start, 30).toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(discoverySnapshotExpiry(start, 999).toISOString()).toBe("2027-08-21T00:00:00.000Z");
  });
});
