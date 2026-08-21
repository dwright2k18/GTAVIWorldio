import { describe, expect, it, vi } from "vitest";

import { classifyMeaningfulChange, meaningfulContentHash } from "@/lib/discovery/change-detection";
import { shouldCreateCandidateForSnapshot } from "@/lib/discovery/baseline";
import { parseFeedItems } from "@/lib/discovery/connectors/feeds";
import { parseHtmlListing } from "@/lib/discovery/connectors/html";
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
    const xml = `<rss><channel><item><title>GTA VI update</title><link>https://example.com/story?utm_source=rss</link><description>Short sourced summary.</description><pubDate>Wed, 20 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>`;
    const parsed = parseFeedItems(xml, officialSource, officialSource.url);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].canonicalUrl).toBe("https://example.com/story");
    expect(parsed[0].summary).toBe("Short sourced summary.");
  });

  it("limits HTML listing extraction to configured paths", () => {
    const html = `<a href="/newswire/article/allowed">Official GTA VI update</a><a href="/support/private">Ignore this support link</a>`;
    const parsed = parseHtmlListing(html, officialSource, officialSource.url);
    expect(parsed.map((entry) => entry.title)).toEqual(["Official GTA VI update"]);
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
