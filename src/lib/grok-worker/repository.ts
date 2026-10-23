import "server-only";

import { and, count, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  candidateEvidence,
  discoveryAlerts,
  discoveryCandidates,
  grokAlerts,
  grokAuditEvents,
  grokAutomationControls,
  grokIdempotencyRecords,
  grokPublicationDailyCounters,
  grokPublicationEvaluations,
  grokRateLimitBuckets,
  grokSubmissions,
  grokValidationRuns,
  grokWorkerCredentials,
  grokWorkers,
  grokWorkItems,
  grokWorkLeases,
  monitoredSources,
  sources,
  stories,
  storySources,
} from "@/db/schema";
import { textToArticleBlocks } from "@/lib/cms/content";
import { articleDraftSchema, seoPackageSchema } from "@/lib/ai/schemas";
import type {
  GrokWorkerPrincipal,
  WorkerCredentialRecord,
  WorkerCredentialRepository,
} from "./auth";
import { sha256 } from "./crypto";
import type { AutomaticPublicationInput } from "./policy";
import {
  isArtifactAllowedForWorkKind,
  requiredArtifactsByWorkKind,
  type GrokArtifactKind,
} from "./schemas";
import { grokCandidateSnapshotHash } from "./snapshot";

export class GrokWorkerRepository implements WorkerCredentialRepository {
  async findCredentialByPrefix(
    prefix: string,
  ): Promise<WorkerCredentialRecord | null> {
    const [record] = await db
      .select({
        credentialId: grokWorkerCredentials.id,
        workerId: grokWorkerCredentials.workerId,
        tokenDigest: grokWorkerCredentials.tokenDigest,
        tokenVersion: grokWorkerCredentials.tokenVersion,
        credentialExpiresAt: grokWorkerCredentials.expiresAt,
        credentialRevokedAt: grokWorkerCredentials.revokedAt,
        scopes: grokWorkerCredentials.scopes,
        workerStatus: grokWorkers.status,
        workerEnvironment: grokWorkers.environment,
        workerTokenVersion: grokWorkers.tokenVersion,
        workerRevokedAt: grokWorkers.revokedAt,
      })
      .from(grokWorkerCredentials)
      .innerJoin(grokWorkers, eq(grokWorkerCredentials.workerId, grokWorkers.id))
      .where(eq(grokWorkerCredentials.tokenPrefix, prefix))
      .limit(1);
    return record ?? null;
  }

  async touchCredential(credentialId: string, workerId: string) {
    const now = new Date();
    await Promise.all([
      db
        .update(grokWorkerCredentials)
        .set({ lastUsedAt: now })
        .where(eq(grokWorkerCredentials.id, credentialId)),
      db
        .update(grokWorkers)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(grokWorkers.id, workerId)),
    ]);
  }

  async controls() {
    const [controls] = await db
      .select()
      .from(grokAutomationControls)
      .where(eq(grokAutomationControls.singleton, true))
      .limit(1);
    return controls ?? null;
  }

  async consumeRateLimit(workerId: string, scope: string, maximum: number) {
    await db
      .delete(grokRateLimitBuckets)
      .where(lt(grokRateLimitBuckets.bucketStart, new Date(Date.now() - 2 * 86_400_000)));
    const result = await db.execute(sql<{ request_count: number }>`
      insert into public.grok_rate_limit_buckets (
        worker_id, scope, bucket_start, request_count, updated_at
      ) values (
        ${workerId}::uuid, ${scope}, date_trunc('minute', now()), 1, now()
      )
      on conflict (worker_id, scope, bucket_start) do update
      set request_count = public.grok_rate_limit_buckets.request_count + 1,
          updated_at = now()
      where public.grok_rate_limit_buckets.request_count < ${maximum}
      returning request_count
    `);
    return result[0]?.request_count ?? null;
  }

  async findIdempotentResponse(
    credentialId: string,
    routeKey: string,
    idempotencyKey: string,
  ) {
    const [record] = await db
      .select()
      .from(grokIdempotencyRecords)
      .where(
        and(
          eq(grokIdempotencyRecords.credentialId, credentialId),
          eq(grokIdempotencyRecords.routeKey, routeKey),
          eq(grokIdempotencyRecords.idempotencyKey, idempotencyKey),
          gt(grokIdempotencyRecords.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  async claimIdempotency(input: {
    credentialId: string;
    routeKey: string;
    idempotencyKey: string;
    requestHash: string;
  }) {
    await db
      .delete(grokIdempotencyRecords)
      .where(lt(grokIdempotencyRecords.expiresAt, new Date()));
    const [record] = await db
      .insert(grokIdempotencyRecords)
      .values({
        ...input,
        responseStatus: 102,
        responseBody: { state: "IN_PROGRESS" },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      })
      .onConflictDoNothing()
      .returning({ id: grokIdempotencyRecords.id });
    return record ?? null;
  }

  async finalizeIdempotency(input: {
    id: string;
    responseStatus: number;
    responseBody: Record<string, unknown>;
  }) {
    await db
      .update(grokIdempotencyRecords)
      .set({
        responseStatus: input.responseStatus,
        responseBody: input.responseBody,
      })
      .where(eq(grokIdempotencyRecords.id, input.id));
  }

  async leaseWork(
    principal: GrokWorkerPrincipal,
    leaseToken: string,
    leaseSeconds = 1_800,
  ) {
    const result = await db.execute<{
      work_item_id: string;
      candidate_id: string;
      kind: string;
      input_snapshot_hash: string;
      revision: number;
      lease_expires_at: Date;
    }>(sql`
      select * from private.grok_lease_work(
        ${principal.workerId}::uuid,
        ${principal.credentialId}::uuid,
        ${sha256(leaseToken)},
        ${leaseSeconds}
      )
    `);
    return result[0] ?? null;
  }

  private async activeLease(
    workItemId: string,
    workerId: string,
    leaseToken: string,
  ) {
    const [lease] = await db
      .select({
        lease: grokWorkLeases,
        workItem: grokWorkItems,
      })
      .from(grokWorkLeases)
      .innerJoin(grokWorkItems, eq(grokWorkLeases.workItemId, grokWorkItems.id))
      .where(
        and(
          eq(grokWorkLeases.workItemId, workItemId),
          eq(grokWorkLeases.workerId, workerId),
          eq(grokWorkLeases.leaseTokenDigest, sha256(leaseToken)),
          isNull(grokWorkLeases.releasedAt),
          gt(grokWorkLeases.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!lease) throw new Error("ACTIVE_LEASE_REQUIRED");
    return lease;
  }

  async loadContext(workItemId: string, workerId: string, leaseToken: string) {
    const { workItem } = await this.activeLease(workItemId, workerId, leaseToken);
    const [record] = await db
      .select({
        candidate: {
          id: discoveryCandidates.id,
          title: discoveryCandidates.title,
          sourceUrl: discoveryCandidates.sourceUrl,
          canonicalUrl: discoveryCandidates.canonicalUrl,
          sourcePublishedAt: discoveryCandidates.sourcePublishedAt,
          excerpt: discoveryCandidates.excerpt,
          verificationRecommendation:
            discoveryCandidates.verificationRecommendation,
          confidenceScore: discoveryCandidates.confidenceScore,
          duplicateStatus: discoveryCandidates.duplicateStatus,
          mediaRightsStatus: discoveryCandidates.mediaRightsStatus,
          conflictingClaims: discoveryCandidates.conflictingClaims,
        },
        source: {
          id: monitoredSources.id,
          name: monitoredSources.name,
          url: monitoredSources.url,
          domain: monitoredSources.domain,
          sourceType: monitoredSources.sourceType,
          authorityTier: monitoredSources.authorityTier,
          isFirstParty: monitoredSources.isFirstParty,
        },
      })
      .from(discoveryCandidates)
      .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
      .where(eq(discoveryCandidates.id, workItem.candidateId))
      .limit(1);
    if (!record) throw new Error("WORK_CONTEXT_NOT_FOUND");

    const evidence = await db
      .select({
        id: candidateEvidence.id,
        sourceUrl: candidateEvidence.sourceUrl,
        title: candidateEvidence.title,
        author: candidateEvidence.author,
        publishedAt: candidateEvidence.publishedAt,
        authorityTier: candidateEvidence.authorityTier,
        authorityScore: candidateEvidence.authorityScore,
        isPrimary: candidateEvidence.isPrimary,
        isCorroborating: candidateEvidence.isCorroborating,
        extractedFacts: candidateEvidence.extractedFacts,
        exactQuotes: candidateEvidence.exactQuotes,
        rightsNotes: candidateEvidence.rightsNotes,
      })
      .from(candidateEvidence)
      .where(eq(candidateEvidence.candidateId, workItem.candidateId))
      .orderBy(desc(candidateEvidence.isPrimary), desc(candidateEvidence.authorityScore));

    return {
      workItem: {
        id: workItem.id,
        kind: workItem.kind,
        revision: workItem.revision,
        inputSnapshotHash: workItem.inputSnapshotHash,
      },
      ...record,
      evidence,
    };
  }

  async heartbeat(workItemId: string, workerId: string, leaseToken: string) {
    const { lease } = await this.activeLease(workItemId, workerId, leaseToken);
    const [updated] = await db
      .update(grokWorkLeases)
      .set({
        heartbeatAt: new Date(),
        expiresAt: sql`least(${grokWorkLeases.leasedAt} + interval '2 hours', now() + interval '30 minutes')`,
      })
      .where(eq(grokWorkLeases.id, lease.id))
      .returning({ expiresAt: grokWorkLeases.expiresAt });
    return updated;
  }

  async submitArtifact(input: {
    workItemId: string;
    principal: GrokWorkerPrincipal;
    leaseToken: string;
    artifactKind: GrokArtifactKind;
    schemaVersion: string;
    revision: number;
    inputSnapshotHash: string;
    payload: Record<string, unknown>;
    payloadHash: string;
    idempotencyKey: string;
  }) {
    const { workItem } = await this.activeLease(
      input.workItemId,
      input.principal.workerId,
      input.leaseToken,
    );
    if (workItem.inputSnapshotHash !== input.inputSnapshotHash) {
      throw new Error("EVIDENCE_SNAPSHOT_CHANGED");
    }
    if (workItem.revision !== input.revision) {
      throw new Error("WORK_REVISION_MISMATCH");
    }
    if (!isArtifactAllowedForWorkKind(workItem.kind, input.artifactKind)) {
      throw new Error("ARTIFACT_NOT_ALLOWED_FOR_WORK_KIND");
    }
    const payloadCandidateId = input.payload.candidateId;
    if (
      typeof payloadCandidateId === "string" &&
      payloadCandidateId !== workItem.candidateId
    ) {
      throw new Error("CANDIDATE_CONTEXT_MISMATCH");
    }
    const [submission] = await db
      .insert(grokSubmissions)
      .values({
        workItemId: input.workItemId,
        candidateId: workItem.candidateId,
        workerId: input.principal.workerId,
        credentialId: input.principal.credentialId,
        artifactKind: input.artifactKind,
        schemaVersion: input.schemaVersion,
        revision: input.revision,
        inputSnapshotHash: input.inputSnapshotHash,
        payload: input.payload,
        payloadHash: input.payloadHash,
        idempotencyKey: input.idempotencyKey,
        status: "ACCEPTED",
      })
      .returning({ id: grokSubmissions.id, createdAt: grokSubmissions.createdAt });
    return submission;
  }

  async loadValidationContext(
    workItemId: string,
    workerId: string,
    leaseToken: string,
  ) {
    const { workItem } = await this.activeLease(workItemId, workerId, leaseToken);
    const [candidate] = await db
      .select({
        id: discoveryCandidates.id,
        mediaRightsStatus: discoveryCandidates.mediaRightsStatus,
      })
      .from(discoveryCandidates)
      .where(eq(discoveryCandidates.id, workItem.candidateId))
      .limit(1);
    if (!candidate) throw new Error("WORK_CONTEXT_NOT_FOUND");
    const evidence = await db
      .select({
        id: candidateEvidence.id,
        sourceUrl: candidateEvidence.sourceUrl,
        authorityTier: candidateEvidence.authorityTier,
        sourceIsFirstParty: monitoredSources.isFirstParty,
        extractedFacts: candidateEvidence.extractedFacts,
        exactQuotes: candidateEvidence.exactQuotes,
      })
      .from(candidateEvidence)
      .leftJoin(monitoredSources, eq(candidateEvidence.sourceId, monitoredSources.id))
      .where(eq(candidateEvidence.candidateId, workItem.candidateId));
    const submissions = await db
      .select({
        id: grokSubmissions.id,
        workItemId: grokSubmissions.workItemId,
        workItemKind: grokWorkItems.kind,
        workerId: grokSubmissions.workerId,
        artifactKind: grokSubmissions.artifactKind,
        payload: grokSubmissions.payload,
        payloadHash: grokSubmissions.payloadHash,
        inputSnapshotHash: grokSubmissions.inputSnapshotHash,
        createdAt: grokSubmissions.createdAt,
      })
      .from(grokSubmissions)
      .innerJoin(grokWorkItems, eq(grokSubmissions.workItemId, grokWorkItems.id))
      .where(
        and(
          eq(grokSubmissions.candidateId, workItem.candidateId),
          eq(grokSubmissions.status, "ACCEPTED"),
        ),
      );
    return { candidate, evidence, submissions };
  }

  async recordValidationRuns(
    candidateId: string,
    results: Array<{
      submissionId: string;
      validationType: string;
      validatorVersion: string;
      inputSnapshotHash: string;
      passed: boolean;
      findings: Array<Record<string, unknown>>;
    }>,
  ) {
    if (!results.length) return;
    await db.insert(grokValidationRuns).values(
      results.map((result) => ({
        candidateId,
        ...result,
      })),
    ).onConflictDoNothing();
  }

  async loadPublicationContext(candidateId: string) {
    const [record] = await db
      .select({ candidate: discoveryCandidates, source: monitoredSources })
      .from(discoveryCandidates)
      .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
      .where(eq(discoveryCandidates.id, candidateId))
      .limit(1);
    if (!record) throw new Error("WORK_CONTEXT_NOT_FOUND");
    const evidence = await db
      .select({
        id: candidateEvidence.id,
        sourceId: candidateEvidence.sourceId,
        sourceUrl: candidateEvidence.sourceUrl,
        authorityTier: candidateEvidence.authorityTier,
        extractedFacts: candidateEvidence.extractedFacts,
        exactQuotes: candidateEvidence.exactQuotes,
        rightsNotes: candidateEvidence.rightsNotes,
        updatedAt: candidateEvidence.updatedAt,
      })
      .from(candidateEvidence)
      .where(eq(candidateEvidence.candidateId, candidateId))
      .orderBy(candidateEvidence.id);
    const currentSnapshotHash = grokCandidateSnapshotHash({
      candidate: {
        id: record.candidate.id,
        status: record.candidate.status,
        duplicateStatus: record.candidate.duplicateStatus,
        verificationRecommendation: record.candidate.verificationRecommendation,
        confidenceScore: record.candidate.confidenceScore,
        conflictingClaims: record.candidate.conflictingClaims,
        mediaRightsStatus: record.candidate.mediaRightsStatus,
        sourceUrl: record.candidate.sourceUrl,
      },
      source: {
        id: record.source.id,
        authorityTier: record.source.authorityTier,
        isFirstParty: record.source.isFirstParty,
        url: record.source.url,
      },
      evidence,
    });
    const submissions = await db
      .select()
      .from(grokSubmissions)
      .where(
        and(
          eq(grokSubmissions.candidateId, candidateId),
          eq(grokSubmissions.status, "ACCEPTED"),
        ),
      )
      .orderBy(desc(grokSubmissions.createdAt));
    const draft = submissions.find(
      (submission) => submission.artifactKind === "ARTICLE_DRAFT",
    );
    const claimMap = submissions.find(
      (submission) => submission.artifactKind === "CLAIM_EVIDENCE_MAP",
    );
    const factCheck = submissions.find(
      (submission) => submission.artifactKind === "FACT_CHECK_RESULT",
    );
    const seo = submissions.find(
      (submission) => submission.artifactKind === "SEO_PACKAGE",
    );
    if (!claimMap || !draft || !factCheck || !seo) {
      return { ready: false as const, reason: "PUBLICATION_BUNDLE_REQUIRED" };
    }
    const validationRuns = await db
      .select()
      .from(grokValidationRuns)
      .where(eq(grokValidationRuns.candidateId, candidateId));
    const hasPassed = (validationType: string, submissionId: string) =>
      validationRuns.some(
        (run) =>
          run.passed &&
          run.validationType === validationType &&
          run.submissionId === submissionId &&
          run.inputSnapshotHash === draft.inputSnapshotHash,
      );
    const candidateSourceIds = [
      ...new Set(
        [record.source.id, ...evidence.map((item) => item.sourceId)].filter(
          (sourceId): sourceId is string => Boolean(sourceId),
        ),
      ),
    ];
    const [gap] = await db
      .select({ count: count() })
      .from(discoveryAlerts)
      .where(
        and(
          eq(discoveryAlerts.alertType, "OFFICIAL_SOURCE_GAP"),
          inArray(discoveryAlerts.sourceId, candidateSourceIds),
          sql`${discoveryAlerts.status} in ('NEW', 'ACKNOWLEDGED')`,
        ),
      );
    const controls = await this.controls();
    if (!controls) return { ready: false as const, reason: "CONTROLS_MISSING" };
    const usageDate = new Date().toISOString().slice(0, 10);
    const [counter] = await db
      .select()
      .from(grokPublicationDailyCounters)
      .where(eq(grokPublicationDailyCounters.usageDate, usageDate))
      .limit(1);

    const policyInput: AutomaticPublicationInput = {
      sourceIsFirstParty: record.source.isFirstParty,
      sourceActive: record.source.isActive,
      sourceAuthorityTier: record.source.authorityTier,
      candidateStatus: record.candidate.status,
      candidateIsTest: record.candidate.isTest,
      verificationStatus: record.candidate.verificationRecommendation,
      confidenceScore: record.candidate.confidenceScore,
      unresolvedSourceGapCount: Number(gap?.count ?? 0),
      hasConflictingEvidence: record.candidate.conflictingClaims.length > 0,
      duplicateStatus: record.candidate.duplicateStatus,
      everyClaimHasEvidence: hasPassed("CLAIM_EVIDENCE", claimMap.id),
      everyQuoteHasProvenance: hasPassed("QUOTE_PROVENANCE", claimMap.id),
      groundingPassed: hasPassed("GROUNDING", draft.id),
      factCheckPassed: hasPassed("FACT_CHECK", factCheck.id),
      mediaRightsPassed: hasPassed("COPYRIGHT", draft.id),
      seoPassed: hasPassed("SEO", seo.id),
      dailyPublicationCap: controls.dailyPublicationCap,
      dailyPublicationCount: counter?.publishedCount ?? 0,
      emergencyStop: controls.emergencyStop,
      apiEnabled: controls.apiEnabled,
      databaseAutoPublishEnabled: controls.autoPublishEnabled,
      environmentAutoPublishEnabled: false,
      evidenceSnapshotMatches: currentSnapshotHash === draft.inputSnapshotHash,
      independentFactCheckRun: hasPassed("FACT_CHECK", factCheck.id),
      defaultAuthorConfigured: Boolean(controls.defaultAuthorId),
    };

    return {
      ready: true as const,
      record,
      evidence,
      draft,
      claimMap,
      factCheck,
      seo,
      controls,
      currentSnapshotHash,
      policyInput,
    };
  }

  async recordBlockedPublicationEvaluation(input: {
    candidateId: string;
    draftSubmissionId: string;
    policyVersion: string;
    gateSnapshot: Record<string, boolean>;
    evidenceSnapshotHash: string;
  }) {
    const [evaluation] = await db
      .insert(grokPublicationEvaluations)
      .values({
        candidateId: input.candidateId,
        draftSubmissionId: input.draftSubmissionId,
        policyVersion: input.policyVersion,
        decision: "BLOCKED",
        allGatesPassed: false,
        gateSnapshot: input.gateSnapshot,
        evidenceSnapshotHash: input.evidenceSnapshotHash,
      })
      .onConflictDoNothing()
      .returning({ id: grokPublicationEvaluations.id });
    return evaluation ?? null;
  }

  async publishApprovedCandidateAtomically(input: {
    context: Extract<Awaited<ReturnType<GrokWorkerRepository["loadPublicationContext"]>>, { ready: true }>;
    policyVersion: string;
    gateSnapshot: Record<string, boolean>;
    audit?: {
      principal: GrokWorkerPrincipal;
      workItemId: string;
      requestId: string;
    };
  }) {
    const draft = articleDraftSchema.parse(input.context.draft.payload);
    const seo = seoPackageSchema.parse(input.context.seo.payload);
    const bodyText = [
      ...draft.introduction.map((block) => block.text),
      ...draft.bodySections.flatMap((section) => [
        `## ${section.heading}`,
        ...section.paragraphs.map((paragraph) => paragraph.text),
      ]),
      "## Why it matters",
      ...draft.whyItMatters.map((block) => block.text),
      "## Confirmed facts",
      ...draft.confirmedFacts.map((block) => block.text),
      ...draft.necessaryContext.map((block) => block.text),
      ...draft.limitations,
    ].join("\n\n");
    const now = new Date();
    const usageDate = now.toISOString().slice(0, 10);

    return db.transaction(async (tx) => {
      await tx.execute(sql`select id from public.discovery_candidates where id = ${input.context.record.candidate.id}::uuid for update`);
      await tx.execute(sql`select singleton from public.grok_automation_controls where singleton = true for update`);
      const [controls] = await tx
        .select()
        .from(grokAutomationControls)
        .where(eq(grokAutomationControls.singleton, true))
        .limit(1);
      if (
        !controls?.apiEnabled ||
        !controls.autoPublishEnabled ||
        controls.emergencyStop ||
        !controls.defaultAuthorId ||
        controls.dailyPublicationCap <= 0
      ) {
        throw new Error("AUTO_PUBLICATION_DISABLED");
      }
      const [locked] = await tx
        .select({ candidate: discoveryCandidates, source: monitoredSources })
        .from(discoveryCandidates)
        .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
        .where(eq(discoveryCandidates.id, input.context.record.candidate.id))
        .limit(1);
      if (
        !locked ||
        locked.candidate.storyId ||
        locked.candidate.isTest ||
        !["DISCOVERED", "TRIAGED", "RESEARCHING"].includes(
          locked.candidate.status,
        ) ||
        locked.candidate.verificationRecommendation !== "CONFIRMED" ||
        locked.candidate.confidenceScore < 95 ||
        locked.candidate.duplicateStatus !== "NEW_STORY" ||
        locked.candidate.conflictingClaims.length > 0 ||
        !locked.source.isFirstParty ||
        !locked.source.isActive ||
        locked.source.authorityTier !== "TIER_1" ||
        !["OFFICIAL_EMBEDDABLE", "OWNED", "LICENSED"].includes(
          locked.candidate.mediaRightsStatus,
        )
      ) {
        throw new Error("AUTO_PUBLICATION_POLICY_CHANGED");
      }
      if (input.context.factCheck.workerId === input.context.draft.workerId) {
        throw new Error("AUTO_PUBLICATION_FACT_CHECK_NOT_INDEPENDENT");
      }
      await tx.execute(sql`select id from public.monitored_sources where id = ${locked.source.id}::uuid for share`);
      const freshEvidence = await tx
        .select({
          id: candidateEvidence.id,
          sourceId: candidateEvidence.sourceId,
          sourceUrl: candidateEvidence.sourceUrl,
          authorityTier: candidateEvidence.authorityTier,
          extractedFacts: candidateEvidence.extractedFacts,
          exactQuotes: candidateEvidence.exactQuotes,
          rightsNotes: candidateEvidence.rightsNotes,
          updatedAt: candidateEvidence.updatedAt,
        })
        .from(candidateEvidence)
        .where(eq(candidateEvidence.candidateId, locked.candidate.id))
        .orderBy(candidateEvidence.id);
      const freshSnapshotHash = grokCandidateSnapshotHash({
        candidate: {
          id: locked.candidate.id,
          status: locked.candidate.status,
          duplicateStatus: locked.candidate.duplicateStatus,
          verificationRecommendation: locked.candidate.verificationRecommendation,
          confidenceScore: locked.candidate.confidenceScore,
          conflictingClaims: locked.candidate.conflictingClaims,
          mediaRightsStatus: locked.candidate.mediaRightsStatus,
          sourceUrl: locked.candidate.sourceUrl,
        },
        source: {
          id: locked.source.id,
          authorityTier: locked.source.authorityTier,
          isFirstParty: locked.source.isFirstParty,
          url: locked.source.url,
        },
        evidence: freshEvidence,
      });
      if (
        freshSnapshotHash !== input.context.currentSnapshotHash ||
        freshSnapshotHash !== input.context.draft.inputSnapshotHash
      ) {
        throw new Error("EVIDENCE_SNAPSHOT_CHANGED");
      }
      const candidateSourceIds = [
        ...new Set(
          [locked.source.id, ...freshEvidence.map((item) => item.sourceId)].filter(
            (sourceId): sourceId is string => Boolean(sourceId),
          ),
        ),
      ];
      const [activeGap] = await tx
        .select({ count: count() })
        .from(discoveryAlerts)
        .where(
          and(
            eq(discoveryAlerts.alertType, "OFFICIAL_SOURCE_GAP"),
            inArray(discoveryAlerts.sourceId, candidateSourceIds),
            sql`${discoveryAlerts.status} in ('NEW', 'ACKNOWLEDGED')`,
          ),
        );
      if (Number(activeGap?.count ?? 0) > 0) {
        throw new Error("AUTO_PUBLICATION_SOURCE_GAP");
      }
      const currentValidations = await tx
        .select({
          type: grokValidationRuns.validationType,
          submissionId: grokValidationRuns.submissionId,
        })
        .from(grokValidationRuns)
        .where(
          and(
            eq(grokValidationRuns.candidateId, locked.candidate.id),
            eq(grokValidationRuns.inputSnapshotHash, freshSnapshotHash),
            eq(grokValidationRuns.passed, true),
          ),
        );
      const requiredValidations = [
        ["CLAIM_EVIDENCE", input.context.claimMap.id],
        ["QUOTE_PROVENANCE", input.context.claimMap.id],
        ["GROUNDING", input.context.draft.id],
        ["FACT_CHECK", input.context.factCheck.id],
        ["COPYRIGHT", input.context.draft.id],
        ["SEO", input.context.seo.id],
      ] as const;
      for (const [requiredType, submissionId] of requiredValidations) {
        if (
          !currentValidations.some(
            (validation) =>
              validation.type === requiredType &&
              validation.submissionId === submissionId,
          )
        ) {
          throw new Error("AUTO_PUBLICATION_VALIDATION_CHANGED");
        }
      }
      const [slot] = await tx.execute<{ usage_date: string }>(sql`
        insert into public.grok_publication_daily_counters (
          usage_date, publication_cap, reserved_count, published_count, updated_at
        ) values (${usageDate}::date, ${controls.dailyPublicationCap}, 1, 0, now())
        on conflict (usage_date) do update
        set publication_cap = excluded.publication_cap,
            reserved_count = public.grok_publication_daily_counters.reserved_count + 1,
            updated_at = now()
        where public.grok_publication_daily_counters.reserved_count < excluded.publication_cap
        returning usage_date
      `);
      if (!slot) throw new Error("DAILY_PUBLICATION_CAP_REACHED");

      const [source] = await tx
        .insert(sources)
        .values({
          name: locked.source.name,
          url: locked.candidate.sourceUrl,
          sourceType: locked.source.sourceType,
          publication: locked.source.name,
          sourcePublishedAt: locked.candidate.sourcePublishedAt,
          isFirstParty: true,
          verificationNotes: "Tier 1 first-party source validated by grok_publication_v1.",
        })
        .onConflictDoUpdate({
          target: sources.url,
          set: { isFirstParty: true, updatedAt: now },
        })
        .returning({ id: sources.id });

      const [story] = await tx
        .insert(stories)
        .values({
          headline: draft.workingHeadline,
          slug: seo.stableSlug,
          urlPath: seo.canonicalPath,
          subtitle: draft.dek,
          summary: draft.summary,
          body: textToArticleBlocks(bodyText),
          bodyText,
          contentType: "NEWS",
          verificationStatus: "CONFIRMED",
          status: "PUBLISHED",
          authorId: controls.defaultAuthorId,
          primarySourceId: source.id,
          originalSourcePublishedAt: locked.candidate.sourcePublishedAt,
          publishedAt: now,
          seoTitleOverride: seo.seoTitle,
          metaDescriptionOverride: seo.metaDescription,
          openGraphTitleOverride: seo.openGraphTitle,
          openGraphDescriptionOverride: seo.openGraphDescription,
          structuredData: seo.articleSchemaFields,
          internalNotes: `Created by ${input.policyVersion}; source evidence remains in the private newsroom.`,
        })
        .returning({ id: stories.id, urlPath: stories.urlPath });
      await tx.insert(storySources).values({
        storyId: story.id,
        sourceId: source.id,
        isPrimary: true,
        evidenceNotes: "Validated Tier 1 first-party evidence.",
      });
      await tx
        .update(discoveryCandidates)
        .set({
          status: "PROMOTED_TO_STORY",
          storyId: story.id,
          updatedAt: now,
        })
        .where(eq(discoveryCandidates.id, locked.candidate.id));
      await tx
        .update(grokPublicationDailyCounters)
        .set({ publishedCount: sql`${grokPublicationDailyCounters.publishedCount} + 1`, updatedAt: now })
        .where(eq(grokPublicationDailyCounters.usageDate, usageDate));
      await tx.insert(grokPublicationEvaluations).values({
        candidateId: locked.candidate.id,
        draftSubmissionId: input.context.draft.id,
        policyVersion: input.policyVersion,
        decision: "PUBLISHED",
        allGatesPassed: true,
        gateSnapshot: input.gateSnapshot,
        evidenceSnapshotHash: input.context.currentSnapshotHash,
        storyId: story.id,
      });
      await tx.insert(grokAuditEvents).values({
        workerId: input.audit?.principal.workerId,
        credentialId: input.audit?.principal.credentialId,
        workItemId: input.audit?.workItemId,
        candidateId: locked.candidate.id,
        action: "GROK_AUTO_PUBLICATION_COMMITTED",
        requestId: input.audit?.requestId ?? crypto.randomUUID(),
        requestHash: freshSnapshotHash,
        outcome: "PUBLISHED",
        metadata: {
          storyId: story.id,
          urlPath: story.urlPath,
          policyVersion: input.policyVersion,
        },
      });
      return story;
    });
  }

  async completeWork(workItemId: string, workerId: string, leaseToken: string) {
    const { lease, workItem } = await this.activeLease(
      workItemId,
      workerId,
      leaseToken,
    );
    const submissions = await db
      .select({ artifactKind: grokSubmissions.artifactKind })
      .from(grokSubmissions)
      .where(
        and(
          eq(grokSubmissions.workItemId, workItemId),
          eq(grokSubmissions.status, "ACCEPTED"),
        ),
      )
    if (!submissions.length) throw new Error("ACCEPTED_ARTIFACT_REQUIRED");
    const submittedKinds = new Set(
      submissions.map((submission) => submission.artifactKind),
    );
    const missing = requiredArtifactsByWorkKind[workItem.kind].filter(
      (kind) => !submittedKinds.has(kind),
    );
    if (missing.length) throw new Error("REQUIRED_ARTIFACTS_MISSING");
    await db.transaction(async (tx) => {
      await tx
        .update(grokWorkItems)
        .set({ status: "COMPLETED", updatedAt: new Date() })
        .where(eq(grokWorkItems.id, workItemId));
      await tx
        .update(grokWorkLeases)
        .set({ releasedAt: new Date(), releaseReason: "COMPLETED" })
        .where(eq(grokWorkLeases.id, lease.id));
    });
    return { candidateId: workItem.candidateId };
  }

  async releaseWork(
    workItemId: string,
    workerId: string,
    leaseToken: string,
    reason: string,
    retryAfterSeconds: number,
  ) {
    const { lease, workItem } = await this.activeLease(
      workItemId,
      workerId,
      leaseToken,
    );
    await db.transaction(async (tx) => {
      await tx
        .update(grokWorkLeases)
        .set({ releasedAt: new Date(), releaseReason: reason.slice(0, 500) })
        .where(eq(grokWorkLeases.id, lease.id));
      await tx
        .update(grokWorkItems)
        .set({
          status: "READY",
          notBefore: new Date(Date.now() + retryAfterSeconds * 1_000),
          updatedAt: new Date(),
        })
        .where(eq(grokWorkItems.id, workItemId));
    });
    return { candidateId: workItem.candidateId };
  }

  async reportException(input: {
    workItemId: string;
    principal: GrokWorkerPrincipal;
    leaseToken: string;
    code: string;
    severity: string;
    summary: string;
    sourceUrls: string[];
    retryable: boolean;
  }) {
    const { workItem } = await this.activeLease(
      input.workItemId,
      input.principal.workerId,
      input.leaseToken,
    );
    const [alert] = await db
      .insert(grokAlerts)
      .values({
        alertType: input.code,
        severity: input.severity,
        workerId: input.principal.workerId,
        workItemId: input.workItemId,
        candidateId: workItem.candidateId,
        detail: input.summary,
        metadata: {
          sourceUrls: input.sourceUrls,
          retryable: input.retryable,
        },
      })
      .returning({ id: grokAlerts.id });
    return alert;
  }

  async createSystemAlert(input: {
    alertType: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    candidateId?: string;
    workItemId?: string;
    detail: string;
    metadata?: Record<string, unknown>;
  }) {
    const [alert] = await db
      .insert(grokAlerts)
      .values({
        alertType: input.alertType,
        severity: input.severity,
        candidateId: input.candidateId,
        workItemId: input.workItemId,
        detail: input.detail.slice(0, 1_000),
        metadata: input.metadata ?? {},
      })
      .returning({ id: grokAlerts.id });
    return alert;
  }

  async appendAudit(input: {
    principal?: GrokWorkerPrincipal;
    workItemId?: string;
    candidateId?: string;
    action: string;
    requestId: string;
    requestHash?: string;
    outcome: string;
    metadata?: Record<string, unknown>;
  }) {
    await db.insert(grokAuditEvents).values({
      workerId: input.principal?.workerId,
      credentialId: input.principal?.credentialId,
      workItemId: input.workItemId,
      candidateId: input.candidateId,
      action: input.action,
      requestId: input.requestId,
      requestHash: input.requestHash,
      outcome: input.outcome,
      metadata: input.metadata ?? {},
    });
  }
}
