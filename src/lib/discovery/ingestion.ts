import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  candidateEvidence,
  discoveryAlerts,
  discoveryAuditLogs,
  discoveryCandidates,
  discoverySettings,
  discoveryUsageDaily,
  monitoredSources,
  sourceFetchRuns,
  sourceSnapshots,
  storyClusters,
} from "@/db/schema";

import { assessDuplicate, clusterEventKey } from "./deduplication";
import { shouldCreateCandidateForSnapshot } from "./baseline";
import { connectorFor } from "./connectors";
import type { DiscoveryFetcher } from "./connectors/base";
import { buildSafeResearchPacket } from "./research";
import { discoverySnapshotExpiry } from "./retention-policy";
import { scoreCandidate } from "./scoring";
import type { DiscoverySource } from "./types";
import { recurringDiscoveryEnabled } from "./pipeline";

type IngestionMode = "TEST_ONLY" | "MANUAL_TEST" | "RECURRING";

function asDiscoverySource(source: typeof monitoredSources.$inferSelect): DiscoverySource {
  return source;
}

function nextUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function runDiscoverySource(
  sourceId: string,
  options: { mode: IngestionMode; fetcher?: DiscoveryFetcher; allowCandidateCreation?: boolean },
) {
  const [source] = await db.select().from(monitoredSources).where(eq(monitoredSources.id, sourceId)).limit(1);
  if (!source) throw new Error("Monitored source not found.");
  const [settings] = await db.select().from(discoverySettings).limit(1);

  if (options.mode === "RECURRING") {
    if (!recurringDiscoveryEnabled() || !settings?.recurringMonitoringEnabled) {
      throw new Error("Recurring discovery is not activated.");
    }
    if (!source.isActive) throw new Error("This source is inactive.");
    if (source.circuitOpenUntil && source.circuitOpenUntil > new Date()) {
      await db.insert(sourceFetchRuns).values({
        sourceId: source.id,
        status: "CIRCUIT_OPEN",
        requestCount: 0,
        completedAt: new Date(),
        errorCode: "CIRCUIT_OPEN",
        errorMessage: "The connector is paused after repeated failures.",
      });
      return { status: "CIRCUIT_OPEN" as const, candidates: [] };
    }
    if (source.nextCheckAt && source.nextCheckAt > new Date()) {
      await db.insert(sourceFetchRuns).values({
        sourceId: source.id,
        status: "SKIPPED",
        requestCount: 0,
        completedAt: new Date(),
        errorCode: "MINIMUM_INTERVAL",
        errorMessage: "The configured minimum check interval has not elapsed.",
      });
      return { status: "MINIMUM_INTERVAL" as const, candidates: [] };
    }

    const oneHourAgo = new Date(Date.now() - 3_600_000);
    const [recent] = await db
      .select({ total: sql<number>`coalesce(sum(${sourceFetchRuns.requestCount}), 0)` })
      .from(sourceFetchRuns)
      .where(and(eq(sourceFetchRuns.sourceId, source.id), gte(sourceFetchRuns.startedAt, oneHourAgo)));
    if (Number(recent.total) >= source.rateLimitPerHour) {
      await db.insert(sourceFetchRuns).values({
        sourceId: source.id,
        status: "SKIPPED",
        requestCount: 0,
        completedAt: new Date(),
        errorCode: "SOURCE_RATE_LIMIT",
        errorMessage: "The configured per-source request limit has been reached.",
      });
      return { status: "RATE_LIMITED" as const, candidates: [] };
    }

    const [dailyUsage] = await db
      .select({ requestCount: discoveryUsageDaily.requestCount })
      .from(discoveryUsageDaily)
      .where(eq(discoveryUsageDaily.usageDate, nextUtcDate()))
      .limit(1);
    if ((dailyUsage?.requestCount ?? 0) >= settings.maxRequestsPerDay) {
      await db.insert(sourceFetchRuns).values({
        sourceId: source.id,
        status: "SKIPPED",
        requestCount: 0,
        completedAt: new Date(),
        errorCode: "DAILY_REQUEST_LIMIT",
        errorMessage: "The configured daily discovery request limit has been reached.",
      });
      return { status: "DAILY_RATE_LIMITED" as const, candidates: [] };
    }
  }

  const startedAt = new Date();
  try {
    const result = await connectorFor(asDiscoverySource(source)).fetch(asDiscoverySource(source), options.fetcher);
    const candidateLimit = settings?.maxCandidatesPerRun ?? 20;
    const scoredCandidates = result.items.slice(0, candidateLimit).map((item) => {
      const scored = scoreCandidate(asDiscoverySource(source), item);
      return { scored, research: buildSafeResearchPacket(scored), isTest: options.mode !== "RECURRING" };
    });
    if (options.mode === "TEST_ONLY") {
      return { status: "TEST_ONLY" as const, result, candidates: scoredCandidates };
    }

    const completedAt = new Date();
    if (!result.extractionSucceeded || result.health === "FAILED") {
      const failures = source.consecutiveFailures + 1;
      const message = result.warnings.join(" ").slice(0, 2_000) || "The connector could not extract required public source data.";
      await db.insert(sourceFetchRuns).values({
        sourceId: source.id,
        status: "FAILED",
        isTestRun: options.mode === "MANUAL_TEST",
        startedAt,
        completedAt,
        httpStatus: result.httpStatus,
        requestCount: result.requestCount,
        responseBytes: result.responseBytes,
        itemsSeen: result.items.length,
        errorCode: "EXTRACTION_FAILED",
        errorMessage: message,
        metadata: { extractionMethod: result.extractionMethod, warnings: result.warnings },
      });
      await db.update(monitoredSources).set({
        healthStatus: failures >= 3 ? "CIRCUIT_OPEN" : "FAILED",
        lastCheckedAt: completedAt,
        lastSuccessfulFetchAt: completedAt,
        lastFailureAt: completedAt,
        lastHttpStatus: result.httpStatus,
        lastExtractionMethod: result.extractionMethod,
        lastContentHash: result.lastContentHash ?? result.responseHash,
        lastError: message,
        consecutiveFailures: failures,
        circuitOpenUntil: failures >= 3 ? new Date(completedAt.valueOf() + 6 * 3_600_000) : null,
      }).where(eq(monitoredSources.id, source.id));
      await db.insert(discoveryAuditLogs).values({
        actorType: "AUTOMATION",
        action: options.mode === "MANUAL_TEST" ? "MANUAL_SOURCE_TEST_FAILED" : "SOURCE_EXTRACTION_FAILED",
        reason: "The public endpoint was reachable, but required relevant data could not be extracted. No candidate was created.",
        metadata: { sourceId: source.id, extractionMethod: result.extractionMethod, warnings: result.warnings },
      });
      if (source.authorityTier === "TIER_1") {
        await db.insert(discoveryAlerts).values({
          sourceId: source.id,
          alertType: "SOURCE_CONNECTOR_FAILURE",
          priority: failures >= 3 ? 85 : 65,
          title: `${source.name} connector needs attention`,
          detail: message,
        });
      }
      return { status: "FAILED" as const, result, candidates: scoredCandidates, created: 0, duplicates: 0, assessments: [] };
    }

    const existingFingerprints = await db
      .select({
        id: discoveryCandidates.id,
        sourceId: discoveryCandidates.sourceId,
        canonicalUrl: discoveryCandidates.canonicalUrl,
        normalizedTitle: discoveryCandidates.normalizedTitle,
        contentHash: discoveryCandidates.contentHash,
        sourcePublishedAt: discoveryCandidates.sourcePublishedAt,
      })
      .from(discoveryCandidates)
      .orderBy(desc(discoveryCandidates.discoveredAt))
      .limit(500);

    const [previousSnapshot] = await db
      .select()
      .from(sourceSnapshots)
      .where(eq(sourceSnapshots.sourceId, source.id))
      .orderBy(desc(sourceSnapshots.checkedAt))
      .limit(1);
    const priorSnapshotRows = await db
      .select({ contentHash: sourceSnapshots.contentHash })
      .from(sourceSnapshots)
      .where(eq(sourceSnapshots.sourceId, source.id))
      .orderBy(desc(sourceSnapshots.checkedAt))
      .limit(1_000);
    const priorSnapshotHashes = new Set(priorSnapshotRows.map(({ contentHash }) => contentHash));
    const isInitialBaseline = priorSnapshotHashes.size === 0;
    let created = 0;
    let duplicates = 0;
    const assessments: Array<{ title: string; status: string; reason: string; matchingCandidateId?: string }> = [];
    const allowCandidateCreation = options.mode === "RECURRING" || options.allowCandidateCreation === true;

    for (const { scored, research } of scoredCandidates) {
      const item = scored.item;
      const canonicalUrl = item.canonicalUrl ?? item.url;
      const wasPreviouslySeen = priorSnapshotHashes.has(item.contentHash);

      await db.insert(sourceSnapshots).values({
        sourceId: source.id,
        normalizedUrl: canonicalUrl,
        title: item.title,
        sourceHash: item.sourceHash,
        contentHash: item.contentHash,
        changeType: item.changeType,
        meaningfulChange: Boolean(previousSnapshot && previousSnapshot.contentHash !== item.contentHash),
        publishedAt: item.publishedAt,
        expiresAt: discoverySnapshotExpiry(new Date(), settings?.retentionDays ?? 30),
        metadata: item.metadata,
      }).onConflictDoNothing({ target: [sourceSnapshots.sourceId, sourceSnapshots.contentHash] });

      const duplicate = assessDuplicate({
        canonicalUrl,
        title: item.title,
        contentHash: item.contentHash,
        publishedAt: item.publishedAt,
      }, existingFingerprints);
      assessments.push({
        title: item.title,
        status: duplicate.status,
        reason: duplicate.reason,
        matchingCandidateId: duplicate.matchingCandidateId?.startsWith("run:") ? undefined : duplicate.matchingCandidateId,
      });
      if (duplicate.status !== "NEW_STORY" && duplicate.matchingCandidateId) {
        duplicates += 1;
        if (duplicate.matchingCandidateId.startsWith("run:")) {
          await db.insert(discoveryAuditLogs).values({
            actorType: "AUTOMATION",
            action: "SAME_RUN_ITEM_CLUSTERED",
            reason: "A second source item represented the same event already seen in this connector run. No candidate was created.",
            metadata: { sourceId: source.id, sourceUrl: canonicalUrl, duplicateStatus: duplicate.status, similarity: duplicate.similarity },
          });
          continue;
        }
        const matching = existingFingerprints.find(({ id }) => id === duplicate.matchingCandidateId);
        const attachedEvidence = await db.insert(candidateEvidence).values({
          candidateId: duplicate.matchingCandidateId,
          sourceId: source.id,
          sourceUrl: canonicalUrl,
          title: item.title,
          author: item.author,
          publishedAt: item.publishedAt,
          authorityTier: source.authorityTier,
          authorityScore: source.reliabilityScore,
          isPrimary: matching?.sourceId === source.id,
          isCorroborating: matching?.sourceId !== source.id,
          extractedFacts: scored.knownFacts.map(({ fact }) => fact),
          verificationNotes: `${duplicate.status}: ${duplicate.reason}`,
          rightsNotes: scored.mediaRightsStatus,
        }).onConflictDoNothing({ target: [candidateEvidence.candidateId, candidateEvidence.sourceUrl] })
          .returning({ id: candidateEvidence.id });
        if (attachedEvidence.length) {
          await db.update(discoveryCandidates).set({ lastUpdatedAt: new Date(), updatedAt: new Date() })
            .where(eq(discoveryCandidates.id, duplicate.matchingCandidateId));
          await db.insert(discoveryAuditLogs).values({
            candidateId: duplicate.matchingCandidateId,
            actorType: "AUTOMATION",
            action: "SOURCE_EVIDENCE_MATCHED",
            reason: "A source item matched an existing candidate, so evidence was attached without creating a duplicate candidate.",
            metadata: { sourceId: source.id, duplicateStatus: duplicate.status, similarity: duplicate.similarity },
          });
        }
        continue;
      }

      const shouldCreate = shouldCreateCandidateForSnapshot({
        connectorKind: source.connectorKind,
        isInitialBaseline,
        wasPreviouslySeen,
      });
      if (!shouldCreate || !allowCandidateCreation) {
        existingFingerprints.push({
          id: `run:${item.contentHash}`,
          sourceId: source.id,
          canonicalUrl,
          normalizedTitle: scored.normalizedTitle,
          contentHash: item.contentHash,
          sourcePublishedAt: item.publishedAt ?? null,
        });
        continue;
      }

      const eventKey = clusterEventKey(item.title) || item.contentHash.slice(0, 24);
      await db.insert(storyClusters).values({
        title: item.title,
        normalizedEventKey: eventKey,
        primaryEvent: research.summary,
        primarySourceId: source.id,
        verificationStatus: scored.verificationRecommendation,
        confidenceScore: scored.confidenceScore,
      }).onConflictDoNothing({ target: storyClusters.normalizedEventKey });
      const [cluster] = await db.select().from(storyClusters).where(eq(storyClusters.normalizedEventKey, eventKey)).limit(1);
      if (!cluster) throw new Error("Story cluster could not be prepared.");

      const [candidate] = await db.insert(discoveryCandidates).values({
        clusterId: cluster.id,
        sourceId: source.id,
        title: item.title,
        normalizedTitle: scored.normalizedTitle,
        sourceUrl: item.url,
        canonicalUrl,
        sourceAuthor: item.author,
        sourcePublishedAt: item.publishedAt ?? null,
        excerpt: item.summary,
        sourceHash: item.sourceHash,
        contentHash: item.contentHash,
        changeType: item.changeType,
        status: duplicate.status === "LIKELY_DUPLICATE" ? "DUPLICATE" : "DISCOVERED",
        duplicateStatus: duplicate.status,
        verificationRecommendation: scored.verificationRecommendation,
        confidenceScore: scored.confidenceScore,
        newsworthinessScore: scored.newsworthinessScore,
        seoOpportunityScore: scored.seoOpportunityScore,
        trendScore: scored.trendScore,
        contentOpportunityScore: scored.contentOpportunityScore,
        quickHitScore: scored.quickHitScore,
        primaryVideoScore: scored.primaryVideoScore,
        primaryTopic: scored.primaryTopic,
        secondaryTopics: scored.secondaryTopics,
        searchIntent: scored.searchIntent,
        suggestedKeywords: scored.suggestedKeywords,
        evergreenUpdateRecommended: scored.evergreen.recommended,
        evergreenRecommendation: scored.evergreen.reason,
        internalLinkSuggestions: scored.internalLinks,
        knownFacts: scored.knownFacts,
        uncertainties: scored.uncertainties,
        communityQuestions: [],
        suggestedHeadline: research.headlineSuggestion,
        suggestedSummary: research.summary,
        suggestedSeoTitle: research.seoTitleSuggestion,
        suggestedMetaDescription: research.metaDescriptionSuggestion,
        suggestedHook: scored.suggestedHook,
        quickHitAngle: scored.quickHitAngle,
        primaryVideoAngle: scored.primaryVideoAngle,
        storyAngles: scored.angles,
        visualAssetSuggestions: [],
        mediaRightsStatus: scored.mediaRightsStatus,
        isTest: false,
      }).returning({ id: discoveryCandidates.id });

      await db.insert(candidateEvidence).values({
        candidateId: candidate.id,
        sourceId: source.id,
        sourceUrl: canonicalUrl,
        title: item.title,
        author: item.author,
        publishedAt: item.publishedAt,
        authorityTier: source.authorityTier,
        authorityScore: source.reliabilityScore,
        isPrimary: true,
        extractedFacts: scored.knownFacts.map(({ fact }) => fact),
        verificationNotes: scored.uncertainties.join(" "),
        rightsNotes: scored.mediaRightsStatus,
      });
      await db.insert(discoveryAuditLogs).values({
        candidateId: candidate.id,
        clusterId: cluster.id,
        actorType: "AUTOMATION",
        action: "CANDIDATE_CREATED",
        reason: "Source connector created a discovery candidate. No story was created or published.",
        metadata: { sourceId: source.id, priority: scored.priority },
      });

      const alert = scored.newsworthinessScore >= 90 && source.authorityTier === "TIER_1"
        ? { alertType: "URGENT_OFFICIAL_UPDATE" as const, priority: scored.newsworthinessScore, detail: "High-impact first-party development requires immediate editorial review." }
        : scored.seoOpportunityScore >= 80
          ? { alertType: "HIGH_VALUE_SEO_OPPORTUNITY" as const, priority: scored.seoOpportunityScore, detail: "This candidate may require a timely evergreen or search-intent update." }
          : duplicate.status === "LIKELY_DUPLICATE"
            ? { alertType: "POSSIBLE_DUPLICATE" as const, priority: 55, detail: duplicate.reason }
            : scored.verificationRecommendation === "ALLEGED_LEAK" && scored.trendScore >= 60
              ? { alertType: "ALLEGED_LEAK_TRENDING" as const, priority: scored.trendScore, detail: "Viral leak claim requires strict evidence and rights review. Do not ingest the alleged asset." }
              : scored.evergreen.recommended && scored.seoOpportunityScore >= 65
                ? { alertType: "EVERGREEN_PAGE_NEEDS_UPDATE" as const, priority: scored.seoOpportunityScore, detail: scored.evergreen.reason ?? "Evergreen update review recommended." }
                : null;
      if (alert) {
        await db.insert(discoveryAlerts).values({
          candidateId: candidate.id,
          clusterId: cluster.id,
          sourceId: source.id,
          title: item.title,
          ...alert,
        });
      }
      created += 1;
      existingFingerprints.push({
        id: candidate.id,
        sourceId: source.id,
        canonicalUrl,
        normalizedTitle: scored.normalizedTitle,
        contentHash: item.contentHash,
        sourcePublishedAt: item.publishedAt ?? null,
      });
    }

    const persistedAt = new Date();
    await db.insert(sourceFetchRuns).values({
      sourceId: source.id,
      status: result.health === "DEGRADED" ? "PARTIAL" : options.mode === "MANUAL_TEST" ? "TEST_ONLY" : "SUCCESS",
      isTestRun: options.mode === "MANUAL_TEST",
      startedAt,
      completedAt: persistedAt,
      httpStatus: result.httpStatus,
      requestCount: result.requestCount,
      responseBytes: result.responseBytes,
      itemsSeen: result.items.length,
      candidatesCreated: created,
      duplicatesSkipped: duplicates,
      metadata: {
        extractionMethod: result.extractionMethod,
        health: result.health,
        warnings: result.warnings,
        assessments,
        candidateCreationAllowed: allowCandidateCreation,
      },
    });
    await db.update(monitoredSources).set({
      healthStatus: result.health,
      lastCheckedAt: persistedAt,
      lastSuccessfulFetchAt: persistedAt,
      lastSuccessfulExtractionAt: persistedAt,
      lastDiscoveredItemAt: result.items.length ? persistedAt : source.lastDiscoveredItemAt,
      lastExtractionMethod: result.extractionMethod,
      lastContentHash: result.lastContentHash ?? result.responseHash,
      lastHttpStatus: result.httpStatus,
      lastError: result.health === "DEGRADED" ? result.warnings.join(" ").slice(0, 2_000) : null,
      consecutiveFailures: 0,
      circuitOpenUntil: null,
      nextCheckAt: new Date(persistedAt.valueOf() + source.minCheckIntervalMinutes * 60_000),
    }).where(eq(monitoredSources.id, source.id));
    if (options.mode === "MANUAL_TEST") {
      await db.insert(discoveryAuditLogs).values({
        actorType: "AUTOMATION",
        action: "MANUAL_SOURCE_TEST_COMPLETED",
        reason: "An explicitly authorized one-time connector test completed with recurring monitoring disabled.",
        metadata: {
          sourceId: source.id,
          health: result.health,
          extractionMethod: result.extractionMethod,
          itemsSeen: result.items.length,
          candidatesCreated: created,
          duplicatesSkipped: duplicates,
        },
      });
    }
    await db.insert(discoveryUsageDaily).values({
      usageDate: nextUtcDate(),
      requestCount: result.requestCount,
      responseBytes: result.responseBytes,
      candidatesCreated: created,
    }).onConflictDoUpdate({
      target: discoveryUsageDaily.usageDate,
      set: {
        requestCount: sql`${discoveryUsageDaily.requestCount} + ${result.requestCount}`,
        responseBytes: sql`${discoveryUsageDaily.responseBytes} + ${result.responseBytes}`,
        candidatesCreated: sql`${discoveryUsageDaily.candidatesCreated} + ${created}`,
        updatedAt: persistedAt,
      },
    });
    return {
      status: result.health === "DEGRADED" ? "PARTIAL" as const : options.mode === "MANUAL_TEST" ? "MANUAL_TEST" as const : "SUCCESS" as const,
      result,
      candidates: scoredCandidates,
      created,
      duplicates,
      assessments,
    };
  } catch (error) {
    if (options.mode === "TEST_ONLY") throw error;
    const completedAt = new Date();
    const failures = source.consecutiveFailures + 1;
    const message = error instanceof Error ? error.message.slice(0, 2_000) : "Unknown connector failure.";
    await db.insert(sourceFetchRuns).values({
      sourceId: source.id,
      status: "FAILED",
      isTestRun: options.mode === "MANUAL_TEST",
      startedAt,
      completedAt,
      requestCount: 1,
      errorCode: "CONNECTOR_FAILURE",
      errorMessage: message,
    });
    await db.update(monitoredSources).set({
      healthStatus: failures >= 3 ? "CIRCUIT_OPEN" : "FAILED",
      lastCheckedAt: completedAt,
      lastFailureAt: completedAt,
      lastError: message,
      consecutiveFailures: failures,
      circuitOpenUntil: failures >= 3 ? new Date(completedAt.valueOf() + 6 * 3_600_000) : null,
    }).where(eq(monitoredSources.id, source.id));
    await db.insert(discoveryAuditLogs).values({
      actorType: "AUTOMATION",
      action: options.mode === "MANUAL_TEST" ? "MANUAL_SOURCE_TEST_FAILED" : "SOURCE_CONNECTOR_FAILED",
      reason: "The connector request failed. No candidate or story was created.",
      metadata: { sourceId: source.id, error: message },
    });
    if (source.authorityTier === "TIER_1") {
      await db.insert(discoveryAlerts).values({
        sourceId: source.id,
        alertType: "SOURCE_CONNECTOR_FAILURE",
        priority: failures >= 3 ? 85 : 65,
        title: `${source.name} connector needs attention`,
        detail: message,
      });
    }
    throw error;
  }
}
