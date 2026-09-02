import { createHash } from "node:crypto";
import type { ZodType } from "zod";

import { aiPermissionDenial } from "@/lib/auth/ai-permissions";
import type { EditorRole } from "@/lib/auth/dal";
import {
  evaluateAiBudget,
  evaluateCandidateEligibility,
  type AiBudgetSettings,
  type AiBudgetUsage,
  type CandidateEligibilityInput,
} from "./eligibility";
import type {
  NewsroomAiProvider,
  ProviderUsage,
} from "./provider";

export type GenerationKind =
  | "RESEARCH_PACKET"
  | "ARTICLE_DRAFT"
  | "SEO_PACKAGE"
  | "PRIMARY_VIDEO"
  | "QUICK_HIT";

export type GenerationReservation = {
  id: string;
  candidateId: string;
  kind: GenerationKind;
  providerCode: string;
  modelId: string;
  promptVersion: string;
  evidenceHash: string;
  idempotencyKey: string;
  actorId: string;
  reason: string;
  reservedInputTokens: number;
  reservedOutputTokens: number;
  reservedCostMicros: number;
};

export interface AiGenerationRepository {
  reserveGeneration(input: GenerationReservation): Promise<void>;
  completeGeneration(id: string, output: unknown, usage: ProviderUsage): Promise<void>;
  failGeneration(id: string, code: string, message: string): Promise<void>;
  appendAudit(input: {
    generationId: string;
    candidateId: string;
    actorId: string;
    action: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export function evidenceHash(evidence: unknown) {
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}

export async function runManualStructuredGeneration<T>(options: {
  generationId: string;
  kind: GenerationKind;
  actor: { id: string; role: EditorRole };
  candidateId: string;
  candidateEligibility: CandidateEligibilityInput;
  evidence: unknown;
  budgetSettings: AiBudgetSettings;
  budgetUsage: AiBudgetUsage;
  predictedUsage: { inputTokens: number; outputTokens: number; costMicros: number };
  provider: NewsroomAiProvider;
  modelId: string;
  schema: ZodType<T>;
  systemRules: string;
  sourceData: string;
  promptVersion: string;
  reason: string;
  idempotencyKey: string;
  timeoutMs: number;
  maxRetries: number;
  repository: AiGenerationRepository;
}) {
  const permission = aiPermissionDenial(
    options.actor.role,
    options.kind === "RESEARCH_PACKET" ? "GENERATE_RESEARCH" : "GENERATE_DRAFT",
  );
  if (permission) throw new Error(permission);
  const eligibility = evaluateCandidateEligibility(options.candidateEligibility);
  if (!eligibility.eligible) {
    throw new Error(`Candidate is not eligible: ${eligibility.reasons.join(" ")}`);
  }
  const budget = evaluateAiBudget(
    options.budgetSettings,
    options.budgetUsage,
    options.predictedUsage,
  );
  if (!budget.allowed) {
    throw new Error(`AI budget is closed: ${budget.reasons.join(", ")}`);
  }
  if (!options.provider.enabled) throw new Error("No approved AI provider is enabled.");

  const hash = evidenceHash(options.evidence);
  await options.repository.reserveGeneration({
    id: options.generationId,
    candidateId: options.candidateId,
    kind: options.kind,
    providerCode: options.provider.code,
    modelId: options.modelId,
    promptVersion: options.promptVersion,
    evidenceHash: hash,
    idempotencyKey: options.idempotencyKey,
    actorId: options.actor.id,
    reason: options.reason,
    reservedInputTokens: options.predictedUsage.inputTokens,
    reservedOutputTokens: options.predictedUsage.outputTokens,
    reservedCostMicros: options.predictedUsage.costMicros,
  });
  await options.repository.appendAudit({
    generationId: options.generationId,
    candidateId: options.candidateId,
    actorId: options.actor.id,
    action: "AI_CALL_INITIATED",
    reason: options.reason,
    metadata: { kind: options.kind, evidenceHash: hash, promptVersion: options.promptVersion },
  });

  try {
    const result = await options.provider.generateStructured({
      modelId: options.modelId,
      systemRules: options.systemRules,
      sourceData: options.sourceData,
      schema: options.schema,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      maxOutputTokens: options.predictedUsage.outputTokens,
      actorId: options.actor.id,
      tags: ["feature:newsroom", `kind:${options.kind.toLowerCase()}`, "env:private"],
    });
    const output = options.schema.parse(result.output);
    await options.repository.completeGeneration(options.generationId, output, result.usage);
    await options.repository.appendAudit({
      generationId: options.generationId,
      candidateId: options.candidateId,
      actorId: options.actor.id,
      action: "AI_OUTPUT_SCHEMA_VALIDATED",
      reason: "Provider output passed the strict Phase 5A schema.",
      metadata: {
        provider: result.providerCode,
        model: result.modelId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costMicros: result.usage.costMicros,
      },
    });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider failure.";
    await options.repository.failGeneration(options.generationId, "PROVIDER_OR_SCHEMA_FAILURE", message);
    await options.repository.appendAudit({
      generationId: options.generationId,
      candidateId: options.candidateId,
      actorId: options.actor.id,
      action: "AI_CALL_FAILED",
      reason: "The private generation failed closed.",
      metadata: { code: "PROVIDER_OR_SCHEMA_FAILURE" },
    });
    throw error;
  }
}
