import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { cronRequestAuthorized } from "@/lib/discovery/cron-auth";
import { HtmlChangeConnector, HtmlListingConnector } from "@/lib/discovery/connectors/html";
import { safeStartingLimits } from "@/lib/discovery/cost";
import {
  CONNECTOR_FAILURE_PAUSE_MS,
  CONNECTOR_FAILURE_THRESHOLD,
  connectorFailureState,
} from "@/lib/discovery/failure-policy";
import type { DiscoverySource } from "@/lib/discovery/types";

const source: DiscoverySource = {
  id: "41000000-0000-4000-8000-000000000001",
  name: "Official GTA VI test source",
  url: "https://www.rockstargames.com/VI",
  domain: "rockstargames.com",
  sourceType: "FIRST_PARTY",
  authorityTier: "TIER_1",
  isFirstParty: true,
  reliabilityScore: 100,
  connectorKind: "HTML_CHANGE",
  connectorConfig: { discoverOfficialArticleLinks: true, maxDetailItems: 99 },
  rateLimitPerHour: 6,
  minCheckIntervalMinutes: 120,
  termsPolicyNotes: "Public metadata only.",
};

function article(index: number) {
  return `<html><head><meta property="og:title" content="Grand Theft Auto VI update ${index}"><meta property="og:description" content="Rockstar Games confirms GTA VI update ${index}."><link rel="canonical" href="https://www.rockstargames.com/newswire/article/update-${index}"></head></html>`;
}

describe("Vercel Cron hardening", () => {
  it("configures one two-hour discovery schedule", () => {
    const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as { crons: Array<{ path: string; schedule: string }> };
    expect(config.crons).toEqual([{ path: "/api/cron/discovery", schedule: "0 */2 * * *" }]);
  });

  it("requires the exact standard CRON_SECRET bearer value", () => {
    expect(cronRequestAuthorized("Bearer pilot-secret", "pilot-secret")).toBe(true);
    expect(cronRequestAuthorized("Bearer wrong", "pilot-secret")).toBe(false);
    expect(cronRequestAuthorized(null, "pilot-secret")).toBe(false);
    expect(cronRequestAuthorized("Bearer pilot-secret", undefined)).toBe(false);
  });
});

describe("official connector detail limits", () => {
  it("caps HTML listing detail requests at three even when configured higher", async () => {
    const links = Array.from({ length: 6 }, (_, index) => `<a href="/newswire/article/update-${index}">Grand Theft Auto VI update ${index}</a>`).join("");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(links, { status: 200, headers: { "content-type": "text/html" } }))
      .mockImplementation(() => Promise.resolve(new Response(article(fetcher.mock.calls.length), { status: 200, headers: { "content-type": "text/html" } })));
    const result = await new HtmlListingConnector().fetch({
      ...source,
      connectorKind: "HTML_LISTING",
      connectorConfig: { linkPrefixes: ["/newswire/article/"], followDetails: true, maxDetailItems: 99 },
    }, fetcher as typeof fetch);
    expect(result.items).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("caps official-page discovered detail requests at three", async () => {
    const links = Array.from({ length: 6 }, (_, index) => `<a href="/newswire/article/update-${index}">Grand Theft Auto VI update ${index}</a>`).join("");
    const base = `<html><head><meta property="og:title" content="Grand Theft Auto VI"><meta property="og:description" content="Official Grand Theft Auto VI news and media."></head><body>${links}</body></html>`;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(base, { status: 200, headers: { "content-type": "text/html" } }))
      .mockImplementation(() => Promise.resolve(new Response(article(fetcher.mock.calls.length), { status: 200, headers: { "content-type": "text/html" } })));
    await new HtmlChangeConnector().fetch(source, fetcher as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});

describe("pilot limits and failure policy", () => {
  it("uses the approved zero-cost pilot caps", () => {
    expect(safeStartingLimits).toMatchObject({
      maxRequestsPerDay: 80,
      maxCandidatesPerRun: 5,
      maxCandidatesPerDay: 5,
      maxAiTriageCallsPerDay: 0,
      maxAiResearchCallsPerDay: 0,
      maxEstimatedMonthlyCostCents: 0,
    });
  });

  it("opens a six-hour circuit on the third consecutive failure", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const second = connectorFailureState(1, now);
    expect(second).toMatchObject({ consecutiveFailures: 2, healthStatus: "FAILED", circuitOpenUntil: null });
    const third = connectorFailureState(CONNECTOR_FAILURE_THRESHOLD - 1, now);
    expect(third.healthStatus).toBe("CIRCUIT_OPEN");
    expect(third.circuitOpenUntil?.valueOf()).toBe(now.valueOf() + CONNECTOR_FAILURE_PAUSE_MS);
  });

  it("keeps every source and automation gate off in the additive migration", () => {
    const migration = readFileSync(resolve("drizzle/0007_phase_4_3_scheduler_hardening.sql"), "utf8");
    expect(migration).not.toMatch(/is_active\s*=\s*true/i);
    expect(migration).toContain("recurring_monitoring_enabled = false");
    expect(migration).toContain("automatic_drafting_enabled = false");
    expect(migration).toContain("deep_research_enabled = false");
    expect(migration).toContain("max_requests_per_day = 80");
    expect(migration).toContain("max_candidates_per_day = 5");
    expect(migration).toContain("REVOKE ALL ON public.discovery_execution_locks FROM anon, authenticated");
  });
});
