import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { HtmlChangeConnector, extractRockstarNewswireUrls } from "@/lib/discovery/connectors/html";
import {
  buildOfficialSourceGap,
  classifyOfficialUrl,
  overallRockstarCoverage,
  resolveOfficialSignalEvents,
  type OfficialSignal,
} from "@/lib/discovery/official-consensus";
import { sha256 } from "@/lib/discovery/normalize";
import { DISCOVERY_SCORING_VERSION, scoreCandidate } from "@/lib/discovery/scoring";
import type { ConnectorItem, DiscoverySource } from "@/lib/discovery/types";

const legitimateCandidateId = "70db3fc3-0671-4824-80b4-6682ac6d7b76";
const referenceTime = new Date("2026-08-06T13:00:00.000Z");

const officialSource: DiscoverySource = {
  id: "41000000-0000-4000-8000-000000000001",
  name: "Rockstar Games official GTA VI signal",
  url: "https://www.rockstargames.com/VI",
  domain: "rockstargames.com",
  sourceType: "FIRST_PARTY",
  authorityTier: "TIER_1",
  isFirstParty: true,
  reliabilityScore: 100,
  connectorKind: "HTML_CHANGE",
  connectorConfig: { includeTerms: ["grand theft auto vi", "gta vi"], discoverOfficialArticleLinks: true },
  rateLimitPerHour: 4,
  minCheckIntervalMinutes: 60,
  termsPolicyNotes: "Public metadata only.",
};

const extendedLook: ConnectorItem = {
  title: "Grand Theft Auto VI: An Extended Look",
  url: "https://www.rockstargames.com/newswire/article/9k2kaa1o3297k9/grand-theft-auto-vi-an-extended-look",
  canonicalUrl: "https://www.rockstargames.com/newswire/article/9k2kaa1o3297k9/grand-theft-auto-vi-an-extended-look",
  summary: "Rockstar Games announced an official extended look at Grand Theft Auto VI.",
  publishedAt: new Date("2026-08-06T12:00:00.000Z"),
  sourceHash: sha256("extended-look-source"),
  contentHash: sha256("extended-look-content"),
  changeType: "TRAILER_ADDED",
  directEvidence: true,
  metadata: { candidateFixtureId: legitimateCandidateId },
};

function scoreSnapshot(value: ReturnType<typeof scoreCandidate>) {
  return {
    version: value.scoringVersion,
    hash: value.inputHash,
    authority: value.sourceAuthorityScore,
    confidence: value.confidenceScore,
    newsworthiness: value.newsworthinessScore,
    seo: value.seoOpportunityScore,
    trend: value.trendScore,
    quickHit: value.quickHitScore,
    primaryVideo: value.primaryVideoScore,
    breakdown: value.scoreBreakdowns,
  };
}

describe("Phase 4.2 deterministic scoring", () => {
  it("returns identical scores and hashes for 10 consecutive legitimate-candidate replays", () => {
    const runs = Array.from({ length: 10 }, () => scoreSnapshot(scoreCandidate(officialSource, extendedLook, {
      independentSourceCount: 1,
      evidenceComplete: true,
      isNovel: true,
      referenceTime,
    })));
    expect(new Set(runs.map((run) => JSON.stringify(run))).size).toBe(1);
    expect(runs[0].version).toBe(DISCOVERY_SCORING_VERSION);
    expect(runs[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes only confidence when one controlled corroborating signal is added", () => {
    const baseline = scoreSnapshot(scoreCandidate(officialSource, extendedLook, {
      independentSourceCount: 1,
      evidenceComplete: true,
      isNovel: true,
      referenceTime,
    }));
    const corroborated = scoreSnapshot(scoreCandidate(officialSource, extendedLook, {
      independentSourceCount: 2,
      evidenceComplete: true,
      isNovel: true,
      referenceTime,
    }));
    expect(corroborated.hash).not.toBe(baseline.hash);
    expect(corroborated.confidence).toBeGreaterThan(baseline.confidence);
    expect({ ...corroborated, hash: baseline.hash, confidence: baseline.confidence, breakdown: baseline.breakdown })
      .toEqual(baseline);
    expect(corroborated.breakdown.CONFIDENCE).not.toEqual(baseline.breakdown.CONFIDENCE);
    expect({ ...corroborated.breakdown, CONFIDENCE: baseline.breakdown.CONFIDENCE }).toEqual(baseline.breakdown);
  });

  it("keeps trend at zero without measured trend inputs", () => {
    const scored = scoreCandidate(officialSource, extendedLook, { referenceTime });
    expect(scored.trendScore).toBe(0);
    expect(scored.scoreBreakdowns.TREND).toEqual([
      expect.objectContaining({ key: "no_trend_inputs", value: 0 }),
    ]);
  });
});

describe("Phase 4.2 official-source consensus", () => {
  it("replays one historical event through three signals as one decision with three evidence records", () => {
    const signals: OfficialSignal[] = [
      { sourceId: "newswire", kind: "NEWSWIRE", title: "Grand Theft Auto VI: An Extended Look", url: extendedLook.url, contentHash: "newswire" },
      { sourceId: "youtube", kind: "YOUTUBE", title: "Grand Theft Auto VI: An Extended Look Coming August 27", url: "https://www.youtube.com/watch?v=official", contentHash: "youtube" },
      { sourceId: "take-two", kind: "TAKE_TWO", title: "Take-Two confirms Grand Theft Auto VI Extended Look", url: "https://www.take2games.com/ir/news/extended-look", contentHash: "take-two" },
    ];
    const events = resolveOfficialSignalEvents(signals);
    expect(events).toHaveLength(1);
    expect(events[0].candidateDecision.status).toBe("NEW_STORY");
    expect(events[0].evidence).toHaveLength(3);
  });

  it("replays Extended Look, preorders, and Trailer 2 without cross-event duplication", () => {
    const fixtures: OfficialSignal[] = [
      { sourceId: "newswire", kind: "NEWSWIRE", title: "Grand Theft Auto VI: An Extended Look", url: "https://www.rockstargames.com/newswire/article/extended", contentHash: "a" },
      { sourceId: "youtube", kind: "YOUTUBE", title: "Grand Theft Auto VI: An Extended Look Coming August 27", url: "https://www.youtube.com/watch?v=extended", contentHash: "b" },
      { sourceId: "newswire", kind: "NEWSWIRE", title: "Pre-Order Grand Theft Auto VI on June 25", url: "https://www.rockstargames.com/newswire/article/preorder", contentHash: "c" },
      { sourceId: "take-two", kind: "TAKE_TWO", title: "Rockstar Games Announces Pre-Orders for Grand Theft Auto VI", url: "https://www.take2games.com/ir/news/preorder", contentHash: "d" },
      { sourceId: "newswire", kind: "NEWSWIRE", title: "Grand Theft Auto VI Trailer 2", url: "https://www.rockstargames.com/newswire/article/trailer-2", contentHash: "e" },
      { sourceId: "take-two", kind: "TAKE_TWO", title: "Rockstar Games Releases Trailer 2 for Grand Theft Auto VI", url: "https://www.take2games.com/ir/news/trailer-2", contentHash: "f" },
    ];
    const events = resolveOfficialSignalEvents(fixtures);
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.evidence.length).sort()).toEqual([2, 2, 2]);
  });

  it("normalizes a newly observed URL before duplicate classification", () => {
    const result = classifyOfficialUrl(`${extendedLook.url}?utm_source=youtube#watch`, {
      evidenceUrls: [extendedLook.url],
    });
    expect(result.canonicalUrl).toBe(extendedLook.url);
    expect(result.classification).toBe("DUPLICATE");
  });

  it("distinguishes NEW, KNOWN, and RELATED official URLs", () => {
    expect(classifyOfficialUrl("https://www.rockstargames.com/VI", { sourceUrls: ["https://www.rockstargames.com/VI/"] }).classification).toBe("KNOWN");
    expect(classifyOfficialUrl("https://www.rockstargames.com/newswire/article/new", {}).classification).toBe("NEW");
    expect(classifyOfficialUrl("https://www.take2games.com/ir/news/corroboration", {}, {
      status: "RELATED",
      similarity: 0.8,
      reason: "Same official event.",
    }).classification).toBe("RELATED");
  });

  it("raises a private gap descriptor without creating or publishing content", () => {
    const gap = buildOfficialSourceGap("https://www.youtube.com/watch?v=official", [
      "https://www.rockstargames.com/newswire/article/new-official-announcement?utm_source=youtube",
    ]);
    expect(gap).toMatchObject({ alertType: "OFFICIAL_SOURCE_GAP", priority: 78 });
    expect(gap?.detail).toContain("could not be resolved");
  });

  it("reports degraded Newswire separately when alternate Rockstar signals are healthy", () => {
    expect(overallRockstarCoverage([
      { label: "Newswire HTML", health: "DEGRADED" },
      { label: "Official YouTube", health: "HEALTHY" },
      { label: "Known pages", health: "HEALTHY" },
      { label: "Take-Two", health: "HEALTHY" },
    ])).toBe("OPERATIONAL_WITH_DEGRADED_SIGNAL");
  });
});

describe("Phase 4.2 lawful Rockstar URL discovery", () => {
  it("extracts normalized public Newswire references from official markup", () => {
    const html = `<a href="/newswire/article/abc123/grand-theft-auto-vi-update?utm_source=vi">Grand Theft Auto VI update</a>`;
    expect(extractRockstarNewswireUrls(html, officialSource.url)).toEqual([
      "https://www.rockstargames.com/newswire/article/abc123/grand-theft-auto-vi-update",
    ]);
  });

  it("follows a bounded official same-domain article reference from a known GTA VI page", async () => {
    const baseHtml = `<html><head><meta property="og:title" content="Grand Theft Auto VI"><meta property="og:description" content="The official Grand Theft Auto VI page with current news and media."></head><body><a href="/newswire/article/new123/grand-theft-auto-vi-update">Grand Theft Auto VI update</a></body></html>`;
    const articleHtml = `<html><head><meta property="og:title" content="Grand Theft Auto VI official update"><meta property="og:description" content="Rockstar Games confirms a public Grand Theft Auto VI update."><link rel="canonical" href="https://www.rockstargames.com/newswire/article/new123/grand-theft-auto-vi-update"></head></html>`;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(baseHtml, { status: 200, headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response(articleHtml, { status: 200, headers: { "content-type": "text/html" } }));
    const result = await new HtmlChangeConnector().fetch(officialSource, fetcher as typeof fetch);
    expect(result.requestCount).toBe(2);
    expect(result.health).toBe("HEALTHY");
    expect(result.items.map((item) => item.canonicalUrl)).toContain("https://www.rockstargames.com/newswire/article/new123/grand-theft-auto-vi-update");
  });

  it("keeps every Phase 4.2 source and automation setting disabled in the additive migration", () => {
    const sql = readFileSync(resolve("drizzle/0006_phase_4_2_discovery_scoring.sql"), "utf8");
    expect(sql).not.toMatch(/is_active\s*=\s*true/i);
    expect(sql).toContain("recurring_monitoring_enabled = false");
    expect(sql).toContain("automatic_drafting_enabled = false");
    expect(sql).toContain("deep_research_enabled = false");
  });
});
