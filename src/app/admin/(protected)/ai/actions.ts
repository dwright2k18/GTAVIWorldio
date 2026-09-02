"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z, type ZodType } from "zod";

import { db } from "@/db";
import {
  aiArticleDrafts,
  aiAuditLogs,
  aiClaims,
  aiContentPackages,
  aiGenerations,
  aiProviderSettings,
  aiQuoteRecords,
  aiResearchPackets,
  aiSeoPackages,
} from "@/db/schema";
import { aiPermissionDenial, type AiNewsroomAction } from "@/lib/auth/ai-permissions";
import { requireEditorAction } from "@/lib/auth/dal";
import { phase5CostModel } from "@/lib/ai/cost";
import { validateDraftGrounding } from "@/lib/ai/grounding";
import { runManualStructuredGeneration, type GenerationKind } from "@/lib/ai/pipeline";
import { articleDraftPrompt, NEWSROOM_SYSTEM_RULES, serializeSourceData } from "@/lib/ai/prompts";
import { createNewsroomProvider } from "@/lib/ai/provider";
import {
  DrizzleAiGenerationRepository,
  loadAiBudgetState,
  loadAiCandidateContext,
} from "@/lib/ai/repository";
import {
  articleDraftSchema,
  primaryVideoPackageSchema,
  quickHitPackageSchema,
  researchPacketSchema,
  seoPackageSchema,
  type ResearchClaim,
} from "@/lib/ai/schemas";
import { aiDraftStatuses, assertAiDraftTransition } from "@/lib/ai/workflow";

const generationInputSchema = z.object({
  candidateId: z.uuid(),
  kind: z.enum(["RESEARCH_PACKET", "ARTICLE_DRAFT", "SEO_PACKAGE", "PRIMARY_VIDEO", "QUICK_HIT"]),
  reason: z.string().trim().min(8).max(2_000),
  idempotencyKey: z.string().trim().min(12).max(200),
});

function assertPermission(role: Parameters<typeof aiPermissionDenial>[0], action: AiNewsroomAction, assigned = false) {
  const denial = aiPermissionDenial(role, action, { assigned });
  if (denial) throw new Error(denial);
}

function predictedUsage(kind: GenerationKind) {
  if (kind === "RESEARCH_PACKET") return phase5CostModel.research;
  if (kind === "ARTICLE_DRAFT") return phase5CostModel.article;
  return phase5CostModel.seoAndContentPackages;
}

function predictedCostMicros(
  usage: { inputTokens: number; outputTokens: number },
  rates: { inputPriceMicrosPerMillion: number; outputPriceMicrosPerMillion: number },
) {
  return Math.ceil(
    (usage.inputTokens * rates.inputPriceMicrosPerMillion +
      usage.outputTokens * rates.outputPriceMicrosPerMillion) /
      1_000_000,
  );
}

function generationSchema(kind: GenerationKind): ZodType<unknown> {
  if (kind === "RESEARCH_PACKET") return researchPacketSchema as ZodType<unknown>;
  if (kind === "ARTICLE_DRAFT") return articleDraftSchema as ZodType<unknown>;
  if (kind === "SEO_PACKAGE") return seoPackageSchema as ZodType<unknown>;
  if (kind === "PRIMARY_VIDEO") return primaryVideoPackageSchema as ZodType<unknown>;
  return quickHitPackageSchema as ZodType<unknown>;
}

export async function generateAiArtifact(formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const input = generationInputSchema.parse(Object.fromEntries(formData.entries()));
  assertPermission(editor.role, input.kind === "RESEARCH_PACKET" ? "GENERATE_RESEARCH" : "GENERATE_DRAFT");
  const context = await loadAiCandidateContext(input.candidateId);
  const budget = await loadAiBudgetState(input.candidateId);
  const evidenceRecords = context.evidence.map(({ evidence, sourceIsFirstParty }) => ({
    id: evidence.id,
    sourceId: evidence.sourceId,
    sourceUrl: evidence.sourceUrl,
    title: evidence.title,
    author: evidence.author,
    publishedAt: evidence.publishedAt,
    authorityTier: evidence.authorityTier,
    authorityScore: evidence.authorityScore,
    isFirstParty: sourceIsFirstParty ?? false,
    extractedFacts: evidence.extractedFacts,
    exactQuotes: evidence.exactQuotes,
    verificationNotes: evidence.verificationNotes,
    rightsNotes: evidence.rightsNotes,
  }));
  const eligibility = {
    sourceIsFirstParty: context.source.isFirstParty,
    sourceAuthorityTier: context.source.authorityTier,
    verificationRecommendation: context.candidate.verificationRecommendation,
    confidenceScore: context.candidate.confidenceScore,
    duplicateStatus: context.candidate.duplicateStatus,
    candidateStatus: context.candidate.status,
    unresolvedSourceGapCount: context.unresolvedGaps.length,
    evidenceCount: evidenceRecords.length,
    officialEvidenceCount: evidenceRecords.filter((evidence) => evidence.isFirstParty).length,
    storyId: context.candidate.storyId,
  };

  const [latestPacket] = await db.select().from(aiResearchPackets)
    .where(eq(aiResearchPackets.candidateId, input.candidateId))
    .orderBy(desc(aiResearchPackets.version)).limit(1);
  const approvedClaimRows = latestPacket ? await db.select().from(aiClaims)
    .where(and(eq(aiClaims.packetId, latestPacket.id), eq(aiClaims.reviewStatus, "APPROVED"))) : [];
  const approvedClaims: ResearchClaim[] = approvedClaimRows.map((claim) => ({
    claimId: claim.claimKey,
    claimText: claim.claimText,
    evidenceRecordIds: claim.evidenceRecordIds,
    sourceUrl: claim.sourceUrl,
    sourceType: claim.sourceType,
    attributionMode: claim.attributionMode,
    confidence: claim.confidence,
    verificationStatus: claim.verificationStatus,
    contradictionStatus: claim.contradictionStatus as ResearchClaim["contradictionStatus"],
    editorReviewStatus: claim.reviewStatus,
    includedInDraft: claim.includedInDraft,
  }));
  if (input.kind !== "RESEARCH_PACKET" && (!latestPacket || !approvedClaims.length)) {
    throw new Error("An approved claim set is required before draft or package generation.");
  }
  const [latestDraft] = input.kind === "RESEARCH_PACKET" || input.kind === "ARTICLE_DRAFT" ? [] : await db.select().from(aiArticleDrafts)
    .where(eq(aiArticleDrafts.candidateId, input.candidateId))
    .orderBy(desc(aiArticleDrafts.version)).limit(1);
  if (["SEO_PACKAGE", "PRIMARY_VIDEO", "QUICK_HIT"].includes(input.kind) && !latestDraft?.groundingPassed) {
    throw new Error("A grounded private article draft is required before packaging.");
  }

  const sourceData = input.kind === "RESEARCH_PACKET"
    ? serializeSourceData({ task: "Create a private evidence-grounded research packet.", candidate: context.candidate, source: context.source, evidenceRecords })
    : input.kind === "ARTICLE_DRAFT"
      ? articleDraftPrompt(latestPacket!.packet, approvedClaims)
      : serializeSourceData({ task: `Create the private ${input.kind} artifact.`, researchPacket: latestPacket!.packet, approvedClaims, groundedDraft: latestDraft!.draft });
  if (sourceData.length > 200_000) throw new Error("The selected evidence package is too large for a bounded Phase 5A request.");
  const modeledUsage = predictedUsage(input.kind);
  const usage = {
    inputTokens: Math.max(modeledUsage.inputTokens, Math.ceil((NEWSROOM_SYSTEM_RULES.length + sourceData.length) / 2)),
    outputTokens: modeledUsage.outputTokens,
  };
  const provider = createNewsroomProvider({ enabled: budget.settings.isEnabled && !budget.settings.emergencyStop, providerCode: budget.settings.providerCode, configurationApproved: process.env.AI_PROVIDER_CONFIGURATION_APPROVED === "true", structuredOutputRequired: budget.settings.structuredOutputRequired, webAccessEnabled: budget.settings.webAccessEnabled });
  const modelId = input.kind === "RESEARCH_PACKET" ? budget.settings.researchModel : budget.settings.draftingModel;
  if (!modelId) throw new Error("No approved model is configured for this generation type.");
  const generationId = randomUUID();
  const output = await runManualStructuredGeneration({
    generationId,
    kind: input.kind,
    actor: editor,
    candidateId: input.candidateId,
    candidateEligibility: eligibility,
    evidence: input.kind === "RESEARCH_PACKET" ? evidenceRecords : { packet: latestPacket!.packet, claims: approvedClaims, draft: latestDraft?.draft },
    budgetSettings: {
      enabled: budget.settings.isEnabled,
      emergencyStop: budget.settings.emergencyStop,
      dailyCallLimit: budget.settings.dailyCallLimit,
      dailyInputTokenLimit: budget.settings.dailyInputTokenLimit,
      dailyOutputTokenLimit: budget.settings.dailyOutputTokenLimit,
      dailyCostLimitMicros: budget.settings.dailyCostLimitMicros,
      perCandidateCallLimit: budget.settings.perCandidateCallLimit,
      perCandidateCostLimitMicros: budget.settings.perCandidateCostLimitMicros,
      maxRegenerations: budget.settings.maxRegenerations,
    },
    budgetUsage: budget.usage,
    predictedUsage: { ...usage, costMicros: predictedCostMicros(usage, budget.settings) },
    provider,
    modelId,
    schema: generationSchema(input.kind),
    systemRules: NEWSROOM_SYSTEM_RULES,
    sourceData,
    promptVersion: `phase5a_${input.kind.toLowerCase()}_v1`,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    timeoutMs: budget.settings.requestTimeoutMs,
    maxRetries: budget.settings.retryLimit,
    repository: new DrizzleAiGenerationRepository(),
  });

  try {
    await materializeOutput({ kind: input.kind, candidateId: input.candidateId, generationId, actorId: editor.id, output, latestPacketId: latestPacket?.id, latestDraftId: latestDraft?.id });
  } catch (error) {
    await db.insert(aiAuditLogs).values({ generationId, candidateId: input.candidateId, actorId: editor.id, action: "AI_OUTPUT_MATERIALIZATION_FAILED", reason: "A schema-valid provider response could not be materialized; immutable generation output remains available for controlled recovery.", metadata: { errorType: error instanceof Error ? error.name : "UnknownError" } });
    throw error;
  }
  revalidatePath(`/admin/ai/${input.candidateId}`);
  revalidatePath(`/admin/discovery/${input.candidateId}`);
}

async function materializeOutput(input: {
  kind: GenerationKind;
  candidateId: string;
  generationId: string;
  actorId: string;
  output: unknown;
  latestPacketId?: string;
  latestDraftId?: string;
}) {
  if (input.kind === "RESEARCH_PACKET") {
    const packet = researchPacketSchema.parse(input.output);
    if (packet.candidateId !== input.candidateId) throw new Error("Research packet candidate ID does not match the request.");
    const claimRecords = [...packet.officialFacts, ...packet.supportingFacts];
    if (new Set(claimRecords.map((claim) => claim.claimId)).size !== claimRecords.length) throw new Error("Research claim IDs must be unique.");
    await db.transaction(async (tx) => {
      const existing = await tx.select().from(aiResearchPackets).where(eq(aiResearchPackets.candidateId, input.candidateId));
      const [createdPacket] = await tx.insert(aiResearchPackets).values({ candidateId: input.candidateId, generationId: input.generationId, version: existing.length + 1, packet, createdBy: input.actorId }).returning();
      const insertedClaims = await tx.insert(aiClaims).values(claimRecords.map((claim) => ({ packetId: createdPacket.id, candidateId: input.candidateId, claimKey: claim.claimId, claimText: claim.claimText, evidenceRecordIds: claim.evidenceRecordIds, sourceUrl: claim.sourceUrl, sourceType: claim.sourceType, attributionMode: claim.attributionMode, confidence: claim.confidence, verificationStatus: claim.verificationStatus, contradictionStatus: claim.contradictionStatus, reviewStatus: "PENDING" as const, includedInDraft: false }))).returning({ id: aiClaims.id, claimKey: aiClaims.claimKey });
      const claimIds = new Map(insertedClaims.map((claim) => [claim.claimKey, claim.id]));
      if (packet.quoteRecords.length) await tx.insert(aiQuoteRecords).values(packet.quoteRecords.map((quote) => ({ packetId: createdPacket.id, claimId: claimIds.get(quote.claimId)!, candidateId: input.candidateId, evidenceId: quote.evidenceId, exactText: quote.exactText, speakerOrganization: quote.speakerOrOrganization, originalSource: quote.originalSource, sourceUrl: quote.sourceUrl, sourceDate: quote.date ? new Date(quote.date) : null, locator: quote.locator, context: quote.context })));
      await tx.insert(aiAuditLogs).values({ generationId: input.generationId, candidateId: input.candidateId, actorId: input.actorId, action: "RESEARCH_PACKET_CREATED", reason: "A schema-valid private research packet was stored for human claim review.", metadata: { claimCount: claimRecords.length, quoteCount: packet.quoteRecords.length } });
    });
    return;
  }
  if (input.kind === "ARTICLE_DRAFT") {
    if (!input.latestPacketId) throw new Error("Research packet is required.");
    const draft = articleDraftSchema.parse(input.output);
    const existing = await db.select().from(aiArticleDrafts).where(eq(aiArticleDrafts.candidateId, input.candidateId));
    await db.insert(aiArticleDrafts).values({ candidateId: input.candidateId, packetId: input.latestPacketId, generationId: input.generationId, version: existing.length + 1, status: "DRAFTING", draft, groundingPassed: false, createdBy: input.actorId, updatedBy: input.actorId });
    return;
  }
  if (!input.latestDraftId) throw new Error("Grounded draft is required.");
  if (input.kind === "SEO_PACKAGE") {
    await db.insert(aiSeoPackages).values({ candidateId: input.candidateId, draftId: input.latestDraftId, generationId: input.generationId, originalSuggestion: seoPackageSchema.parse(input.output) });
  } else {
    const content = input.kind === "PRIMARY_VIDEO" ? primaryVideoPackageSchema.parse(input.output) : quickHitPackageSchema.parse(input.output);
    await db.insert(aiContentPackages).values({ candidateId: input.candidateId, draftId: input.latestDraftId, generationId: input.generationId, kind: input.kind, targetDurationSeconds: content.targetDurationSeconds, content });
  }
}

export async function reviewAiClaim(formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR", "FACT_CHECKER"]);
  assertPermission(editor.role, "REVIEW_CLAIM");
  const input = z.object({ claimId: z.uuid(), candidateId: z.uuid(), reviewStatus: z.enum(["APPROVED", "REJECTED", "NEEDS_REVIEW"]), reason: z.string().trim().min(8).max(2_000) }).parse(Object.fromEntries(formData.entries()));
  await db.update(aiClaims).set({ reviewStatus: input.reviewStatus, includedInDraft: input.reviewStatus === "APPROVED", reviewedBy: editor.id, reviewReason: input.reason, reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(aiClaims.id, input.claimId), eq(aiClaims.candidateId, input.candidateId)));
  await db.insert(aiAuditLogs).values({ candidateId: input.candidateId, actorId: editor.id, action: `CLAIM_${input.reviewStatus}`, reason: input.reason, metadata: { claimId: input.claimId } });
  revalidatePath(`/admin/ai/${input.candidateId}`);
}

export async function runAiGrounding(formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR", "FACT_CHECKER"]);
  assertPermission(editor.role, "RUN_GROUNDING");
  const input = z.object({ draftId: z.uuid(), candidateId: z.uuid() }).parse(Object.fromEntries(formData.entries()));
  const [draft] = await db.select().from(aiArticleDrafts).where(and(eq(aiArticleDrafts.id, input.draftId), eq(aiArticleDrafts.candidateId, input.candidateId))).limit(1);
  if (!draft) throw new Error("AI draft not found.");
  const claimRows = await db.select().from(aiClaims).where(eq(aiClaims.packetId, draft.packetId));
  const quoteRows = await db.select().from(aiQuoteRecords).where(eq(aiQuoteRecords.packetId, draft.packetId));
  const claims: ResearchClaim[] = claimRows.map((claim) => ({ claimId: claim.claimKey, claimText: claim.claimText, evidenceRecordIds: claim.evidenceRecordIds, sourceUrl: claim.sourceUrl, sourceType: claim.sourceType, attributionMode: claim.attributionMode, confidence: claim.confidence, verificationStatus: claim.verificationStatus, contradictionStatus: claim.contradictionStatus as ResearchClaim["contradictionStatus"], editorReviewStatus: claim.reviewStatus, includedInDraft: claim.includedInDraft }));
  const result = validateDraftGrounding(articleDraftSchema.parse(draft.draft), claims, quoteRows.map((quote) => ({ exactText: quote.exactText, claimId: claimRows.find((claim) => claim.id === quote.claimId)?.claimKey ?? "", evidenceId: quote.evidenceId })));
  await db.transaction(async (tx) => {
    await tx.update(aiArticleDrafts).set({ groundingPassed: result.passed, groundingFindings: result.findings, status: result.nextStatus, updatedBy: editor.id, updatedAt: new Date() }).where(eq(aiArticleDrafts.id, draft.id));
    await tx.insert(aiAuditLogs).values({ candidateId: input.candidateId, draftId: draft.id, actorId: editor.id, action: "GROUNDING_VALIDATION_COMPLETED", reason: result.passed ? "All draft claims passed deterministic grounding checks." : "Unsupported material requires fact-check review.", metadata: { passed: result.passed, findingCount: result.findings.length } });
  });
  revalidatePath(`/admin/ai/${input.candidateId}`);
}

export async function editAiArticleDraft(formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR", "AUTHOR"]);
  const input = z.object({ draftId: z.uuid(), candidateId: z.uuid(), draftJson: z.string().min(2).max(200_000), reason: z.string().trim().min(8).max(2_000) }).parse(Object.fromEntries(formData.entries()));
  const context = await loadAiCandidateContext(input.candidateId);
  assertPermission(editor.role, "EDIT_ASSIGNED_DRAFT", context.candidate.assignedTo === editor.id);
  const parsedDraft = articleDraftSchema.parse(JSON.parse(input.draftJson));
  await db.transaction(async (tx) => {
    const changed = await tx.update(aiArticleDrafts).set({ draft: parsedDraft, status: "DRAFTING", groundingPassed: false, groundingFindings: [], updatedBy: editor.id, updatedAt: new Date() }).where(and(eq(aiArticleDrafts.id, input.draftId), eq(aiArticleDrafts.candidateId, input.candidateId))).returning({ id: aiArticleDrafts.id });
    if (!changed.length) throw new Error("AI draft not found.");
    await tx.insert(aiAuditLogs).values({ candidateId: input.candidateId, draftId: input.draftId, actorId: editor.id, action: "AI_DRAFT_EDITED", reason: input.reason, metadata: { originalGenerationPreserved: true, groundingReset: true } });
  });
  revalidatePath(`/admin/ai/${input.candidateId}`);
}

export async function reviewAiDraft(formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR", "FACT_CHECKER"]);
  const input = z.object({ draftId: z.uuid(), candidateId: z.uuid(), nextStatus: z.enum(aiDraftStatuses), reason: z.string().trim().min(8).max(2_000) }).parse(Object.fromEntries(formData.entries()));
  const [draft] = await db.select().from(aiArticleDrafts).where(and(eq(aiArticleDrafts.id, input.draftId), eq(aiArticleDrafts.candidateId, input.candidateId))).limit(1);
  if (!draft) throw new Error("AI draft not found.");
  const permission: AiNewsroomAction = input.nextStatus === "APPROVED" ? "MARK_NEEDS_REVIEW" : input.nextStatus === "FACT_CHECK" ? "SEND_TO_FACT_CHECK" : input.nextStatus === "REJECTED" ? "REJECT_OUTPUT" : "REQUEST_REVISION";
  assertPermission(editor.role, permission);
  if (input.nextStatus === "APPROVED" && !["OWNER", "ADMIN", "EDITOR"].includes(editor.role)) throw new Error("Only an owner, administrator, or editor may approve private AI draft material.");
  assertAiDraftTransition(draft.status, input.nextStatus, { groundingPassed: draft.groundingPassed });
  await db.transaction(async (tx) => {
    await tx.update(aiArticleDrafts).set({ status: input.nextStatus, updatedBy: editor.id, updatedAt: new Date() }).where(eq(aiArticleDrafts.id, input.draftId));
    await tx.insert(aiAuditLogs).values({ candidateId: input.candidateId, draftId: input.draftId, actorId: editor.id, action: `AI_DRAFT_${input.nextStatus}`, reason: input.reason, metadata: { previousStatus: draft.status, publicStoryChanged: false } });
  });
  revalidatePath(`/admin/ai/${input.candidateId}`);
}

export async function cancelAiGeneration(formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const input = z.object({ generationId: z.uuid(), candidateId: z.uuid(), reason: z.string().trim().min(8).max(1_000) }).parse(Object.fromEntries(formData.entries()));
  await db.transaction(async (tx) => {
    const cancelled = await tx.update(aiGenerations).set({ cancellationRequested: true, status: "CANCELLED", completedAt: new Date(), updatedAt: new Date() }).where(and(eq(aiGenerations.id, input.generationId), eq(aiGenerations.candidateId, input.candidateId), inArray(aiGenerations.status, ["REQUESTED", "RUNNING"]))).returning({ id: aiGenerations.id });
    if (!cancelled.length) throw new Error("Only a requested or running generation can be cancelled.");
    await tx.insert(aiAuditLogs).values({ generationId: input.generationId, candidateId: input.candidateId, actorId: editor.id, action: "GENERATION_CANCELLED", reason: input.reason });
  });
  revalidatePath(`/admin/ai/${input.candidateId}`);
}

export async function updateAiSafetySettings(formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN"]);
  assertPermission(editor.role, "CONFIGURE_PROVIDER");
  const explicitBoolean = z.enum(["true", "false"]).transform((value) => value === "true");
  const input = z.object({ id: z.uuid(), providerCode: z.string().trim().max(100), researchModel: z.string().trim().max(200), draftingModel: z.string().trim().max(200), isEnabled: explicitBoolean, emergencyStop: explicitBoolean, inputPriceMicrosPerMillion: z.coerce.number().int().min(0), outputPriceMicrosPerMillion: z.coerce.number().int().min(0), dailyCallLimit: z.coerce.number().int().min(0), dailyInputTokenLimit: z.coerce.number().int().min(0), dailyOutputTokenLimit: z.coerce.number().int().min(0), dailyCostLimitMicros: z.coerce.number().int().min(0), perCandidateCallLimit: z.coerce.number().int().min(0), perCandidateCostLimitMicros: z.coerce.number().int().min(0), maxRegenerations: z.coerce.number().int().min(0), requestTimeoutMs: z.coerce.number().int().min(1_000).max(120_000), retryLimit: z.coerce.number().int().min(0).max(2), reason: z.string().trim().min(12).max(2_000) }).parse(Object.fromEntries(formData.entries()));
  if (input.isEnabled && process.env.AI_PROVIDER_CONFIGURATION_APPROVED !== "true") throw new Error("Provider activation requires the separate server-side approval gate.");
  await db.transaction(async (tx) => {
    await tx.update(aiProviderSettings).set({ providerCode: input.providerCode || null, researchModel: input.researchModel || null, draftingModel: input.draftingModel || null, inputPriceMicrosPerMillion: input.inputPriceMicrosPerMillion, outputPriceMicrosPerMillion: input.outputPriceMicrosPerMillion, isEnabled: input.isEnabled, emergencyStop: input.emergencyStop, dailyCallLimit: input.dailyCallLimit, dailyInputTokenLimit: input.dailyInputTokenLimit, dailyOutputTokenLimit: input.dailyOutputTokenLimit, dailyCostLimitMicros: input.dailyCostLimitMicros, perCandidateCallLimit: input.perCandidateCallLimit, perCandidateCostLimitMicros: input.perCandidateCostLimitMicros, maxRegenerations: input.maxRegenerations, requestTimeoutMs: input.requestTimeoutMs, retryLimit: input.retryLimit, updatedBy: editor.id, updatedAt: new Date() }).where(eq(aiProviderSettings.id, input.id));
    await tx.insert(aiAuditLogs).values({ actorId: editor.id, action: "AI_PROVIDER_SETTINGS_UPDATED", reason: input.reason, metadata: { providerCode: input.providerCode || null, isEnabled: input.isEnabled, emergencyStop: input.emergencyStop, credentialStored: false } });
  });
  revalidatePath("/admin/ai");
}
