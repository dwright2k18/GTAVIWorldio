import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  quickHitPackageSchema,
  type ArticleDraft,
  type SeoPackage,
} from "@/lib/ai/schemas";
import {
  validateWorkerPublicationBundle,
  type StoredWorkerSubmission,
  type WorkerValidationContext,
} from "@/lib/grok-worker/validation";

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const candidateId = "10000000-0000-4000-8000-000000000001";
const evidenceId = "20000000-0000-4000-8000-000000000001";
const researchWorkId = "30000000-0000-4000-8000-000000000001";
const factWorkId = "30000000-0000-4000-8000-000000000002";
const researchWorkerId = "50000000-0000-4000-8000-000000000001";
const factWorkerId = "50000000-0000-4000-8000-000000000002";
const snapshotHash = "a".repeat(64);
const claimText = "Rockstar Games confirmed GTA VI.";

const draft: ArticleDraft = {
  status: "DRAFTING",
  workingHeadline: claimText,
  dek: claimText,
  summary: claimText,
  verificationStatus: "CONFIRMED",
  introduction: [{ text: claimText, claimIds: ["claim-1"] }],
  bodySections: [{
    heading: claimText,
    paragraphs: [{ text: claimText, claimIds: ["claim-1"] }],
  }],
  whyItMatters: [{ text: claimText, claimIds: ["claim-1"] }],
  confirmedFacts: [{ text: claimText, claimIds: ["claim-1"] }],
  necessaryContext: [],
  limitations: [],
  sourceEvidenceIds: [evidenceId],
  relatedEvergreenPath: null,
  relatedStoryIds: [],
  relatedVideoIds: [],
  authorAttribution: "GTAVIWorldio Staff",
  proposedPublishedAt: null,
  proposedUpdatedAt: null,
  correctionsReady: true,
};

const seo: SeoPackage = {
  primarySearchIntent: "GTA VI confirmed",
  primaryTopic: "GTA VI",
  secondaryTopics: [],
  stableSlug: "gta-vi-confirmed",
  h1: "Rockstar Games confirmed GTA VI",
  seoTitle: "Rockstar Games confirmed GTA VI",
  metaDescription: "Rockstar Games confirmed GTA VI in first-party source material.",
  canonicalPath: "/news/gta-vi-confirmed",
  openGraphTitle: "Rockstar Games confirmed GTA VI",
  openGraphDescription: "Rockstar Games confirmed GTA VI in first-party source material.",
  socialImageRecommendation: "Use an approved official embed or owned newsroom graphic.",
  breadcrumbTitle: "GTA VI confirmed",
  articleSchemaFields: { headline: "Rockstar Games confirmed GTA VI" },
  internalLinks: [],
  relatedEvergreenHub: null,
  evergreenUpdate: { recommended: false, path: null, suggestion: null },
  imageAltTextRecommendations: [],
  freshnessFields: { sourcePublishedAt: null, meaningfullyUpdatedAt: null, reviewAfter: null },
  duplicateContentAssessment: { risk: "LOW", reason: "Unique first-party update." },
  seoOpportunity: "Answers current official-news intent.",
  measuredSearchVolume: null,
};

function submission(
  id: string,
  workItemId: string,
  workItemKind: string,
  artifactKind: string,
  payload: Record<string, unknown>,
  workerId = researchWorkerId,
): StoredWorkerSubmission {
  return {
    id,
    workItemId,
    workItemKind,
    workerId,
    artifactKind,
    payload,
    payloadHash: hashPayload(payload),
    inputSnapshotHash: snapshotHash,
    createdAt: new Date(),
  };
}

function validContext(): WorkerValidationContext {
  const claimMap = {
    candidateId,
    evidenceSnapshotHash: snapshotHash,
    claims: [{
      claimId: "claim-1",
      claimText,
      evidenceRecordIds: [evidenceId],
      sourceUrl: "https://www.rockstargames.com/VI",
      sourceType: "FIRST_PARTY",
      attributionMode: "PARAPHRASE",
      confidence: 100,
      verificationStatus: "CONFIRMED",
      contradictionStatus: "NONE",
      editorReviewStatus: "PENDING",
      includedInDraft: true,
    }],
    quotes: [],
  };
  const draftSubmission = submission(
    "40000000-0000-4000-8000-000000000001",
    researchWorkId,
    "DRAFT",
    "ARTICLE_DRAFT",
    draft,
  );
  const factCheck = {
    candidateId,
    independentRunId: factWorkId,
    draftPayloadHash: draftSubmission.payloadHash,
    evidenceSnapshotHash: snapshotHash,
    validatorVersion: "fact-check-v1",
    passed: true,
    claimResults: [{
      claimId: "claim-1",
      passed: true,
      evidenceRecordIds: [evidenceId],
      notes: "Matched stored first-party evidence.",
    }],
    findings: [],
  };
  return {
    candidate: { id: candidateId, mediaRightsStatus: "OFFICIAL_EMBEDDABLE" },
    evidence: [{
      id: evidenceId,
      sourceUrl: "https://www.rockstargames.com/VI",
      authorityTier: "TIER_1",
      sourceIsFirstParty: true,
      extractedFacts: [claimText],
      exactQuotes: [],
    }],
    submissions: [
      submission(
        "40000000-0000-4000-8000-000000000002",
        researchWorkId,
        "RESEARCH",
        "CLAIM_EVIDENCE_MAP",
        claimMap,
      ),
      draftSubmission,
      submission(
        "40000000-0000-4000-8000-000000000003",
        factWorkId,
        "FACT_CHECK",
        "FACT_CHECK_RESULT",
        factCheck,
        factWorkerId,
      ),
      submission(
        "40000000-0000-4000-8000-000000000004",
        researchWorkId,
        "SEO",
        "SEO_PACKAGE",
        seo,
      ),
    ],
  };
}

describe("Grok publication bundle validation", () => {
  it("passes a grounded bundle with an independent fact-check work item", () => {
    const result = validateWorkerPublicationBundle(validContext());
    expect(result.complete).toBe(true);
    expect(result.results.every((entry) => entry.passed)).toBe(true);
  });

  it("fails closed when fact checking is not independent", () => {
    const context = validContext();
    const factCheck = context.submissions.find(
      (item) => item.artifactKind === "FACT_CHECK_RESULT",
    )!;
    factCheck.workItemId = researchWorkId;
    factCheck.workItemKind = "DRAFT";
    const result = validateWorkerPublicationBundle(context);
    expect(result.complete).toBe(true);
    expect(
      result.results.find((entry) => entry.validationType === "FACT_CHECK")?.passed,
    ).toBe(false);
  });

  it("fails closed when the same worker authors and fact-checks", () => {
    const context = validContext();
    const factCheck = context.submissions.find(
      (item) => item.artifactKind === "FACT_CHECK_RESULT",
    )!;
    factCheck.workerId = researchWorkerId;
    const result = validateWorkerPublicationBundle(context);
    expect(
      result.results.find((entry) => entry.validationType === "FACT_CHECK")?.passed,
    ).toBe(false);
  });

  it("rejects invented claims that are merely attached to an official record", () => {
    const context = validContext();
    context.evidence[0].extractedFacts = ["A different official fact."];
    const result = validateWorkerPublicationBundle(context);
    expect(
      result.results.find((entry) => entry.validationType === "CLAIM_EVIDENCE")?.passed,
    ).toBe(false);
  });

  it("fails closed when a bundle mixes evidence snapshots", () => {
    const context = validContext();
    context.submissions.find((item) => item.artifactKind === "SEO_PACKAGE")!
      .inputSnapshotHash = "b".repeat(64);
    const result = validateWorkerPublicationBundle(context);
    expect(
      result.results.find((entry) => entry.validationType === "CLAIM_EVIDENCE")?.passed,
    ).toBe(false);
  });

  it("enforces the exact 13-second Quick Hit contract", () => {
    const quickHit = {
      targetDurationSeconds: 13,
      timeline: [
        { startSecond: 0, endSecond: 2, purpose: "HOOK", voiceover: claimText, claimIds: ["claim-1"] },
        { startSecond: 2, endSecond: 10, purpose: "FACTUAL_PAYOFF", voiceover: claimText, claimIds: ["claim-1"] },
        { startSecond: 10, endSecond: 13, purpose: "QUESTION_OR_LOOP", voiceover: "What do you think", claimIds: ["claim-1"] },
      ],
      onScreenText: [claimText],
      visualSequence: [{ scene: "Approved official trailer embed.", rightsClassification: "OFFICIAL_EMBEDDABLE", sourceUrl: "https://www.youtube.com/watch?v=QdBZY2fkU-0" }],
      caption: claimText,
      platformTitleVariants: { tiktok: claimText, youtubeShorts: claimText, instagram: claimText, facebook: claimText },
      rightsSafeVisualRecommendation: { scene: "Approved official trailer embed.", rightsClassification: "OFFICIAL_EMBEDDABLE", sourceUrl: "https://www.youtube.com/watch?v=QdBZY2fkU-0" },
      relatedPrimaryVideoIdea: "Explain the official announcement with its evidence.",
      relatedArticleId: null,
    };
    expect(quickHitPackageSchema.safeParse(quickHit).success).toBe(true);
    expect(
      quickHitPackageSchema.safeParse({ ...quickHit, targetDurationSeconds: 12 }).success,
    ).toBe(false);
  });
});
