import { count, eq, inArray } from "drizzle-orm";

import { db } from "../src/db";
import {
  discoveryCandidates,
  discoverySettings,
  discoveryUsageDaily,
  monitoredSources,
  stories,
} from "../src/db/schema";
import { runDiscoverySource } from "../src/lib/discovery/ingestion";

const sourceIds = [
  "41000000-0000-4000-8000-000000000001",
  "41000000-0000-4000-8000-000000000009",
  "41000000-0000-4000-8000-000000000004",
];
const preservedCandidateId = "70db3fc3-0671-4824-80b4-6682ac6d7b76";

async function state() {
  const [settings] = await db.select().from(discoverySettings).limit(1);
  const sources = await db.select().from(monitoredSources).where(inArray(monitoredSources.id, sourceIds));
  const [storyCount] = await db.select({ total: count() }).from(stories);
  const [publishedCount] = await db.select({ total: count() }).from(stories).where(inArray(stories.status, ["PUBLISHED", "UPDATED"]));
  const [scheduledCount] = await db.select({ total: count() }).from(stories).where(eq(stories.status, "SCHEDULED"));
  const [candidateCount] = await db.select({ total: count() }).from(discoveryCandidates);
  const [preservedCandidate] = await db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, preservedCandidateId)).limit(1);
  const [usage] = await db.select().from(discoveryUsageDaily).orderBy(discoveryUsageDaily.usageDate).limit(1);
  return { settings, sources, storyCount, publishedCount, scheduledCount, candidateCount, preservedCandidate, usage };
}

function assertSafeState(value: Awaited<ReturnType<typeof state>>) {
  if (!value.settings || value.settings.recurringMonitoringEnabled || value.settings.automaticDraftingEnabled || value.settings.deepResearchEnabled) {
    throw new Error("Discovery automation controls are not in the required disabled state.");
  }
  if (value.sources.length !== sourceIds.length || value.sources.some((source) => source.isActive)) {
    throw new Error("Every controlled-test source must exist and remain inactive.");
  }
  if (Number(value.publishedCount.total) !== 0 || Number(value.scheduledCount.total) !== 0) {
    throw new Error("The controlled test requires every story to remain unpublished and unscheduled.");
  }
  if (!value.preservedCandidate || value.preservedCandidate.storyId || value.preservedCandidate.isTest) {
    throw new Error("The legitimate Phase 4 discovery candidate is missing or was unexpectedly changed.");
  }
}

async function main() {
  const before = await state();
  assertSafeState(before);
  const reports = [];

  for (const source of before.sources) {
    try {
      const run = await runDiscoverySource(source.id, { mode: "MANUAL_TEST" });
      if (!("result" in run) || !run.result || !("assessments" in run)) {
        throw new Error(`Unexpected connector result: ${run.status}`);
      }
      reports.push({
        source: source.name,
        sourceUrl: source.url,
        sourceTier: source.authorityTier,
        sourceAuthority: source.isFirstParty ? "FIRST_PARTY" : source.sourceType,
        status: run.status,
        health: run.result.health,
        extractionMethod: run.result.extractionMethod,
        httpStatus: run.result.httpStatus,
        requestCount: run.result.requestCount,
        responseBytes: run.result.responseBytes,
        warnings: run.result.warnings,
        candidatesCreated: run.created,
        duplicatesOrRelationships: run.duplicates,
        items: run.candidates.map(({ scored }) => ({
          title: scored.item.title,
          url: scored.item.canonicalUrl ?? scored.item.url,
          publicationTime: scored.item.publishedAt?.toISOString() ?? null,
          summary: scored.item.summary ?? "INSUFFICIENT EVIDENCE",
          verification: scored.verificationRecommendation,
          confidence: scored.confidenceScore,
          newsworthiness: scored.newsworthinessScore,
          seoOpportunity: scored.seoOpportunityScore,
          trendPotential: scored.trendScore,
          quickHit: scored.quickHitScore,
          primaryVideo: scored.primaryVideoScore,
          evergreen: scored.evergreen,
        })),
        assessments: run.assessments,
      });
    } catch (error) {
      reports.push({
        source: source.name,
        sourceUrl: source.url,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown connector failure",
      });
    }
  }

  const after = await state();
  assertSafeState(after);
  if (Number(before.storyCount.total) !== Number(after.storyCount.total)) throw new Error("Story count changed during the connector test.");
  if (Number(before.candidateCount.total) !== Number(after.candidateCount.total)) throw new Error("Candidate count changed during the connector test.");

  console.log(JSON.stringify({
    mode: "MANUAL_TEST",
    candidateCreationAllowed: false,
    recurringMonitoring: false,
    automaticDrafting: false,
    deepResearch: false,
    publishing: false,
    estimatedCostMicros: 0,
    counts: {
      stories: Number(after.storyCount.total),
      published: Number(after.publishedCount.total),
      scheduled: Number(after.scheduledCount.total),
      candidates: Number(after.candidateCount.total),
      preservedCandidate: preservedCandidateId,
    },
    reports,
  }, null, 2));

  if (reports.some((report) => report.status === "FAILED")) process.exitCode = 1;
}

void main();
