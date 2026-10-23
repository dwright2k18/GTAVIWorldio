import "server-only";

import { and, count, desc, eq, gte, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  aiArticleDrafts,
  aiAuditLogs,
  aiClaims,
  aiContentPackages,
  aiCostLedger,
  aiGenerations,
  aiProviderSettings,
  aiQuoteRecords,
  aiResearchPackets,
  aiSeoPackages,
  candidateEvidence,
  discoveryAlerts,
  discoveryCandidates,
  monitoredSources,
} from "@/db/schema";
import type {
  AiGenerationRepository,
  GenerationReservation,
} from "./pipeline";
import type { ProviderUsage } from "./provider";

export class DrizzleAiGenerationRepository implements AiGenerationRepository {
  async reserveGeneration(input: GenerationReservation) {
    await db.execute(sql`select public.reserve_ai_generation(
      ${input.id}::uuid, ${input.candidateId}::uuid, ${input.kind}::public.ai_generation_kind,
      ${input.providerCode}, ${input.modelId}, ${input.promptVersion}, ${input.evidenceHash},
      ${input.idempotencyKey}, ${input.actorId}::uuid, ${input.reason},
      ${input.reservedInputTokens}, ${input.reservedOutputTokens}, ${input.reservedCostMicros}
    )`);
  }

  async completeGeneration(id: string, output: unknown, usage: ProviderUsage) {
    await db.transaction(async (tx) => {
      const [generation] = await tx
        .update(aiGenerations)
        .set({
          status: "SUCCEEDED",
          output: output as Record<string, unknown>,
          schemaValidationPassed: true,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          actualCostMicros: usage.costMicros,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(aiGenerations.id, id), eq(aiGenerations.status, "RUNNING"), eq(aiGenerations.cancellationRequested, false)))
        .returning();
      if (!generation) throw new Error("Generation was cancelled or was no longer running before output storage.");
      if (!generation.providerCode || !generation.modelId) {
        throw new Error("Generation provenance is incomplete.");
      }
      await tx.insert(aiCostLedger).values({
        generationId: generation.id,
        candidateId: generation.candidateId,
        usageDate: new Date().toISOString().slice(0, 10),
        providerCode: generation.providerCode,
        modelId: generation.modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostMicros: generation.estimatedCostMicros,
        actualCostMicros: usage.costMicros,
        costMicros: Math.max(generation.estimatedCostMicros, usage.costMicros ?? 0),
      });
    });
  }

  async failGeneration(id: string, code: string, message: string) {
    await db.update(aiGenerations).set({
      status: "FAILED",
      errorCode: code,
      errorMessage: message.slice(0, 1_000),
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(aiGenerations.id, id), ne(aiGenerations.status, "CANCELLED")));
  }

  async appendAudit(input: {
    generationId: string;
    candidateId: string;
    actorId: string;
    action: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }) {
    await db.insert(aiAuditLogs).values({
      generationId: input.generationId,
      candidateId: input.candidateId,
      actorId: input.actorId,
      action: input.action,
      reason: input.reason,
      metadata: input.metadata ?? {},
    });
  }
}

export async function loadAiCandidateContext(candidateId: string) {
  const [record] = await db.select({
    candidate: discoveryCandidates,
    source: monitoredSources,
  }).from(discoveryCandidates)
    .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
    .where(eq(discoveryCandidates.id, candidateId))
    .limit(1);
  if (!record) throw new Error("Discovery candidate not found.");

  const evidence = await db.select({
    evidence: candidateEvidence,
    sourceIsFirstParty: monitoredSources.isFirstParty,
  }).from(candidateEvidence)
    .leftJoin(monitoredSources, eq(candidateEvidence.sourceId, monitoredSources.id))
    .where(eq(candidateEvidence.candidateId, candidateId))
    .orderBy(desc(candidateEvidence.isPrimary), desc(candidateEvidence.authorityScore));
  const activeGaps = await db.select().from(discoveryAlerts)
    .where(and(eq(discoveryAlerts.alertType, "OFFICIAL_SOURCE_GAP"), sql`${discoveryAlerts.status} in ('NEW', 'ACKNOWLEDGED')`));
  const candidateSourceIds = new Set([record.candidate.sourceId, ...evidence.map((row) => row.evidence.sourceId).filter(Boolean)]);
  const unresolvedGaps = activeGaps.filter((alert) => {
    if (!alert.sourceId || !candidateSourceIds.has(alert.sourceId)) return false;
    const normalizeUrl = (url: string) => url.replace(/[.)]+$/, "").replace(/\/$/, "");
    const sourceUrl = normalizeUrl(record.source.url);
    const referencedTargets = (alert.detail.match(/https:\/\/[^\s,]+/g) ?? [])
      .map(normalizeUrl)
      .filter((url) => url !== sourceUrl);
    if (referencedTargets.length === 0) return true;
    return referencedTargets.some((url) =>
      !evidence.some((row) => normalizeUrl(row.evidence.sourceUrl).startsWith(url)),
    );
  });
  return { ...record, evidence, unresolvedGaps };
}

export async function loadAiBudgetState(candidateId: string) {
  const [settings] = await db.select().from(aiProviderSettings).limit(1);
  if (!settings) throw new Error("Phase 5A provider settings are not installed.");
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);
  const [daily] = await db.select({
    calls: count(),
    inputTokens: sql<number>`coalesce(sum(greatest(${aiGenerations.inputTokens}, ${aiGenerations.reservedInputTokens})), 0)::int`,
    outputTokens: sql<number>`coalesce(sum(greatest(${aiGenerations.outputTokens}, ${aiGenerations.reservedOutputTokens})), 0)::int`,
    costMicros: sql<number>`coalesce(sum(greatest(${aiGenerations.estimatedCostMicros}, ${aiGenerations.reservedCostMicros})), 0)::int`,
  }).from(aiGenerations).where(gte(aiGenerations.createdAt, startOfUtcDay));
  const [candidate] = await db.select({
    calls: count(),
    costMicros: sql<number>`coalesce(sum(greatest(${aiGenerations.estimatedCostMicros}, ${aiGenerations.reservedCostMicros})), 0)::int`,
    regenerations: sql<number>`greatest(count(*) - count(distinct ${aiGenerations.kind}), 0)::int`,
  }).from(aiGenerations).where(eq(aiGenerations.candidateId, candidateId));
  return {
    settings,
    usage: {
      dailyCalls: Number(daily.calls),
      dailyInputTokens: Number(daily.inputTokens),
      dailyOutputTokens: Number(daily.outputTokens),
      dailyCostMicros: Number(daily.costMicros),
      candidateCalls: Number(candidate.calls),
      candidateCostMicros: Number(candidate.costMicros),
      candidateRegenerations: Number(candidate.regenerations),
    },
  };
}

export async function getAiCandidateWorkspace(candidateId: string) {
  try {
    const [settings] = await db.select().from(aiProviderSettings).limit(1);
    const generations = await db.select().from(aiGenerations).where(eq(aiGenerations.candidateId, candidateId)).orderBy(desc(aiGenerations.createdAt)).limit(50);
    const packets = await db.select().from(aiResearchPackets).where(eq(aiResearchPackets.candidateId, candidateId)).orderBy(desc(aiResearchPackets.version));
    const claims = await db.select().from(aiClaims).where(eq(aiClaims.candidateId, candidateId)).orderBy(aiClaims.claimKey);
    const drafts = await db.select().from(aiArticleDrafts).where(eq(aiArticleDrafts.candidateId, candidateId)).orderBy(desc(aiArticleDrafts.version));
    const seo = await db.select().from(aiSeoPackages).where(eq(aiSeoPackages.candidateId, candidateId)).orderBy(desc(aiSeoPackages.createdAt));
    const packages = await db.select().from(aiContentPackages).where(eq(aiContentPackages.candidateId, candidateId)).orderBy(desc(aiContentPackages.createdAt));
    const costs = await db.select().from(aiCostLedger).where(eq(aiCostLedger.candidateId, candidateId)).orderBy(desc(aiCostLedger.createdAt));
    const audit = await db.select().from(aiAuditLogs).where(eq(aiAuditLogs.candidateId, candidateId)).orderBy(desc(aiAuditLogs.createdAt)).limit(100);
    return { schemaReady: true as const, settings: settings ?? null, generations, packets, claims, drafts, seo, packages, costs, audit };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI schema is unavailable.";
    if (/ai_(provider_settings|generations|research_packets)/i.test(message) || /does not exist/i.test(message)) {
      return { schemaReady: false as const, settings: null, generations: [], packets: [], claims: [], drafts: [], seo: [], packages: [], costs: [], audit: [] };
    }
    throw error;
  }
}

export async function getAiAdminSummary() {
  try {
    const [settings] = await db.select().from(aiProviderSettings).limit(1);
    const [generationCount] = await db.select({ total: count() }).from(aiGenerations);
    const [draftCount] = await db.select({ total: count() }).from(aiArticleDrafts);
    const [cost] = await db.select({ micros: sql<number>`coalesce(sum(${aiCostLedger.costMicros}), 0)::int` }).from(aiCostLedger);
    return { schemaReady: true as const, settings: settings ?? null, generations: Number(generationCount.total), drafts: Number(draftCount.total), costMicros: Number(cost.micros) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI schema is unavailable.";
    if (/ai_(provider_settings|generations|article_drafts)/i.test(message) || /does not exist/i.test(message)) {
      return { schemaReady: false as const, settings: null, generations: 0, drafts: 0, costMicros: 0 };
    }
    throw error;
  }
}

export { aiQuoteRecords };
