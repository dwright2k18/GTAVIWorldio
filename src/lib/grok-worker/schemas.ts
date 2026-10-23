import { z } from "zod";

import {
  articleDraftSchema,
  primaryVideoPackageSchema,
  quickHitPackageSchema,
  quoteRecordSchema,
  researchClaimSchema,
  researchPacketSchema,
  seoPackageSchema,
} from "@/lib/ai/schemas";

export const grokArtifactKinds = [
  "RESEARCH_PACKET",
  "CLAIM_EVIDENCE_MAP",
  "QUOTE_PROVENANCE",
  "ARTICLE_DRAFT",
  "GROUNDING_RESULT",
  "FACT_CHECK_RESULT",
  "SEO_PACKAGE",
  "PRIMARY_VIDEO_PACKAGE",
  "QUICK_HIT_PACKAGE",
] as const;

export const grokArtifactKindSchema = z.enum(grokArtifactKinds);

export const allowedArtifactsByWorkKind = {
  RESEARCH: ["RESEARCH_PACKET", "CLAIM_EVIDENCE_MAP", "QUOTE_PROVENANCE"],
  DRAFT: ["ARTICLE_DRAFT", "GROUNDING_RESULT"],
  FACT_CHECK: ["FACT_CHECK_RESULT"],
  SEO: ["SEO_PACKAGE"],
  PRIMARY_VIDEO: ["PRIMARY_VIDEO_PACKAGE", "GROUNDING_RESULT"],
  QUICK_HIT: ["QUICK_HIT_PACKAGE", "GROUNDING_RESULT"],
  REVISION: grokArtifactKinds,
} as const satisfies Record<string, readonly GrokArtifactKind[]>;

export function isArtifactAllowedForWorkKind(
  workKind: keyof typeof allowedArtifactsByWorkKind,
  artifactKind: GrokArtifactKind,
) {
  return (allowedArtifactsByWorkKind[workKind] as readonly GrokArtifactKind[])
    .includes(artifactKind);
}

export const requiredArtifactsByWorkKind = {
  RESEARCH: ["RESEARCH_PACKET", "CLAIM_EVIDENCE_MAP"],
  DRAFT: ["ARTICLE_DRAFT"],
  FACT_CHECK: ["FACT_CHECK_RESULT"],
  SEO: ["SEO_PACKAGE"],
  PRIMARY_VIDEO: ["PRIMARY_VIDEO_PACKAGE"],
  QUICK_HIT: ["QUICK_HIT_PACKAGE"],
  REVISION: [],
} as const satisfies Record<string, readonly GrokArtifactKind[]>;

export const grokScopes = [
  "worker:status",
  "queue:lease",
  "candidate:read-leased",
  "artifact:submit",
  "job:complete",
  "exception:write",
] as const;

export const grokScopeSchema = z.enum(grokScopes);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const claimEvidenceMapSchema = z.object({
  candidateId: z.uuid(),
  evidenceSnapshotHash: sha256Schema,
  claims: z.array(researchClaimSchema).min(1).max(200),
  quotes: z.array(quoteRecordSchema).max(100),
});

export const quoteProvenancePackageSchema = z.object({
  candidateId: z.uuid(),
  evidenceSnapshotHash: sha256Schema,
  quotes: z.array(quoteRecordSchema).min(1).max(100),
});

const validationFindingSchema = z.object({
  code: z.string().min(1).max(100),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  location: z.string().max(300).nullable(),
  message: z.string().min(1).max(1_000),
});

export const groundingResultSchema = z.object({
  candidateId: z.uuid(),
  draftPayloadHash: sha256Schema,
  evidenceSnapshotHash: sha256Schema,
  validatorVersion: z.string().min(1).max(100),
  passed: z.boolean(),
  findings: z.array(validationFindingSchema).max(200),
});

export const factCheckResultSchema = z.object({
  candidateId: z.uuid(),
  independentRunId: z.uuid(),
  draftPayloadHash: sha256Schema,
  evidenceSnapshotHash: sha256Schema,
  validatorVersion: z.string().min(1).max(100),
  passed: z.boolean(),
  claimResults: z.array(
    z.object({
      claimId: z.string().min(1).max(100),
      passed: z.boolean(),
      evidenceRecordIds: z.array(z.uuid()).min(1).max(10),
      notes: z.string().max(1_000),
    }),
  ).min(1).max(200),
  findings: z.array(validationFindingSchema).max(200),
});

export const artifactSchemas = {
  RESEARCH_PACKET: researchPacketSchema,
  CLAIM_EVIDENCE_MAP: claimEvidenceMapSchema,
  QUOTE_PROVENANCE: quoteProvenancePackageSchema,
  ARTICLE_DRAFT: articleDraftSchema,
  GROUNDING_RESULT: groundingResultSchema,
  FACT_CHECK_RESULT: factCheckResultSchema,
  SEO_PACKAGE: seoPackageSchema,
  PRIMARY_VIDEO_PACKAGE: primaryVideoPackageSchema,
  QUICK_HIT_PACKAGE: quickHitPackageSchema,
} satisfies Record<(typeof grokArtifactKinds)[number], z.ZodType>;

export const artifactSubmissionEnvelopeSchema = z.object({
  schemaVersion: z.literal("grok-worker-v1"),
  revision: z.number().int().min(1).max(20),
  inputSnapshotHash: sha256Schema,
  payload: z.record(z.string(), z.unknown()),
});

export const workExceptionSchema = z.object({
  code: z.string().min(1).max(100),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  summary: z.string().min(1).max(1_000),
  sourceUrls: z.array(z.url()).max(20).default([]),
  retryable: z.boolean(),
});

export const releaseWorkSchema = z.object({
  reason: z.string().min(1).max(500),
  retryAfterSeconds: z.number().int().min(0).max(86_400).default(0),
});

export type GrokArtifactKind = (typeof grokArtifactKinds)[number];
export type GrokScope = (typeof grokScopes)[number];
