import {
  validateDraftGrounding,
  validatePrimaryVideoGrounding,
  validateQuickHitGrounding,
} from "@/lib/ai/grounding";
import {
  articleDraftSchema,
  primaryVideoPackageSchema,
  quickHitPackageSchema,
  seoPackageSchema,
  type ResearchClaim,
} from "@/lib/ai/schemas";
import {
  claimEvidenceMapSchema,
  factCheckResultSchema,
} from "./schemas";

export type StoredWorkerSubmission = {
  id: string;
  workItemId: string;
  workItemKind: string;
  workerId: string;
  artifactKind: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  inputSnapshotHash: string;
  createdAt: Date;
};

export type WorkerValidationContext = {
  candidate: {
    id: string;
    mediaRightsStatus: string;
  };
  evidence: Array<{
    id: string;
    sourceUrl: string;
    authorityTier: string;
    sourceIsFirstParty: boolean | null;
    extractedFacts: string[];
    exactQuotes: Array<{ text: string; speaker?: string; locator?: string }>;
  }>;
  submissions: StoredWorkerSubmission[];
};

export type ServerValidationResult = {
  submissionId: string;
  validationType:
    | "SCHEMA"
    | "CLAIM_EVIDENCE"
    | "QUOTE_PROVENANCE"
    | "GROUNDING"
    | "FACT_CHECK"
    | "COPYRIGHT"
    | "SEO";
  validatorVersion: string;
  inputSnapshotHash: string;
  passed: boolean;
  findings: Array<Record<string, unknown>>;
};

const validationVersion = "grok_server_validation_v1";

function latestByKind(submissions: StoredWorkerSubmission[]) {
  return new Map(
    [...submissions]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((submission) => [submission.artifactKind, submission]),
  );
}

function normalizedEvidenceText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function result(
  submission: StoredWorkerSubmission,
  validationType: ServerValidationResult["validationType"],
  findings: Array<Record<string, unknown>>,
): ServerValidationResult {
  return {
    submissionId: submission.id,
    validationType,
    validatorVersion: validationVersion,
    inputSnapshotHash: submission.inputSnapshotHash,
    passed: findings.length === 0,
    findings,
  };
}

export function validateWorkerPublicationBundle(
  context: WorkerValidationContext,
) {
  const submissions = latestByKind(context.submissions);
  const claimSubmission = submissions.get("CLAIM_EVIDENCE_MAP");
  const draftSubmission = submissions.get("ARTICLE_DRAFT");
  const factCheckSubmission = submissions.get("FACT_CHECK_RESULT");
  const seoSubmission = submissions.get("SEO_PACKAGE");
  if (!claimSubmission || !draftSubmission || !factCheckSubmission || !seoSubmission) {
    return {
      complete: false as const,
      missing: [
        ["CLAIM_EVIDENCE_MAP", claimSubmission],
        ["ARTICLE_DRAFT", draftSubmission],
        ["FACT_CHECK_RESULT", factCheckSubmission],
        ["SEO_PACKAGE", seoSubmission],
      ].filter(([, submission]) => !submission).map(([kind]) => kind as string),
      results: [] as ServerValidationResult[],
    };
  }

  const claimMap = claimEvidenceMapSchema.parse(claimSubmission.payload);
  const draft = articleDraftSchema.parse(draftSubmission.payload);
  const factCheck = factCheckResultSchema.parse(factCheckSubmission.payload);
  const seo = seoPackageSchema.parse(seoSubmission.payload);
  const evidenceById = new Map(context.evidence.map((evidence) => [evidence.id, evidence]));

  const bundleFindings: Array<Record<string, unknown>> = [];
  const snapshotHashes = new Set(
    [claimSubmission, draftSubmission, factCheckSubmission, seoSubmission].map(
      (submission) => submission.inputSnapshotHash,
    ),
  );
  if (snapshotHashes.size !== 1) {
    bundleFindings.push({ code: "MIXED_EVIDENCE_SNAPSHOTS" });
  }
  if (
    claimMap.candidateId !== context.candidate.id ||
    factCheck.candidateId !== context.candidate.id
  ) {
    bundleFindings.push({ code: "CANDIDATE_CONTEXT_MISMATCH" });
  }
  if (claimMap.evidenceSnapshotHash !== claimSubmission.inputSnapshotHash) {
    bundleFindings.push({ code: "CLAIM_MAP_EVIDENCE_HASH_MISMATCH" });
  }
  if (draft.verificationStatus !== "CONFIRMED") {
    bundleFindings.push({ code: "DRAFT_NOT_CONFIRMED" });
  }
  for (const evidenceId of draft.sourceEvidenceIds) {
    if (!evidenceById.has(evidenceId)) {
      bundleFindings.push({ code: "DRAFT_FOREIGN_EVIDENCE", evidenceId });
    }
  }

  const claimFindings = claimMap.claims.flatMap((claim) => {
    const findings: Array<Record<string, unknown>> = [];
    if (claim.evidenceRecordIds.length === 0) {
      findings.push({ code: "CLAIM_WITHOUT_EVIDENCE", claimId: claim.claimId });
    }
    for (const evidenceId of claim.evidenceRecordIds) {
      if (!evidenceById.has(evidenceId)) {
        findings.push({ code: "FOREIGN_EVIDENCE", claimId: claim.claimId, evidenceId });
      }
    }
    const citedEvidence = claim.evidenceRecordIds
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter((evidence) => Boolean(evidence));
    if (!citedEvidence.some((evidence) => evidence?.sourceUrl === claim.sourceUrl)) {
      findings.push({ code: "CLAIM_SOURCE_URL_MISMATCH", claimId: claim.claimId });
    }
    const normalizedClaim = normalizedEvidenceText(claim.claimText);
    const claimIsStored = citedEvidence.some(
      (evidence) =>
        evidence?.authorityTier === "TIER_1" &&
        evidence.sourceIsFirstParty === true &&
        [
          ...evidence.extractedFacts,
          ...evidence.exactQuotes.map((quote) => quote.text),
        ].some((storedText) => normalizedEvidenceText(storedText) === normalizedClaim),
    );
    if (!claimIsStored) {
      findings.push({ code: "CLAIM_TEXT_NOT_IN_STORED_EVIDENCE", claimId: claim.claimId });
    }
    if (claim.verificationStatus !== "CONFIRMED" || claim.confidence < 95) {
      findings.push({ code: "CLAIM_NOT_AUTO_PUBLISHABLE", claimId: claim.claimId });
    }
    if (claim.contradictionStatus !== "NONE") {
      findings.push({ code: "CLAIM_CONFLICT", claimId: claim.claimId });
    }
    return findings;
  });

  const quoteFindings = claimMap.quotes.flatMap((quote) => {
    const evidence = evidenceById.get(quote.evidenceId);
    if (!evidence) {
      return [{ code: "QUOTE_FOREIGN_EVIDENCE", evidenceId: quote.evidenceId }];
    }
    if (evidence.sourceUrl !== quote.sourceUrl) {
      return [{ code: "QUOTE_SOURCE_URL_MISMATCH", evidenceId: quote.evidenceId }];
    }
    if (
      evidence.authorityTier !== "TIER_1" ||
      evidence.sourceIsFirstParty !== true
    ) {
      return [{ code: "QUOTE_SOURCE_NOT_TIER_ONE_FIRST_PARTY", evidenceId: quote.evidenceId }];
    }
    const exactMatch = evidence.exactQuotes.some(
      (stored) =>
        normalizedEvidenceText(stored.text) ===
          normalizedEvidenceText(quote.exactText) &&
        (!quote.locator || stored.locator === quote.locator),
    );
    return exactMatch
      ? []
      : [{ code: "QUOTE_TEXT_NOT_IN_EVIDENCE", evidenceId: quote.evidenceId }];
  });

  const serverClaims: ResearchClaim[] = claimMap.claims.map((claim) => ({
    ...claim,
    editorReviewStatus: "APPROVED" as const,
  }));
  const quoteProvenance = claimMap.quotes.map((quote) => ({
    exactText: quote.exactText,
    claimId: quote.claimId,
    evidenceId: quote.evidenceId,
  }));
  const grounding = validateDraftGrounding(draft, serverClaims, quoteProvenance);
  const packageGroundingResults: ServerValidationResult[] = [];
  const primaryVideoSubmission = submissions.get("PRIMARY_VIDEO_PACKAGE");
  if (primaryVideoSubmission) {
    const validation = validatePrimaryVideoGrounding(
      primaryVideoPackageSchema.parse(primaryVideoSubmission.payload),
      serverClaims,
      quoteProvenance,
    );
    packageGroundingResults.push(
      result(
        primaryVideoSubmission,
        "GROUNDING",
        validation.findings.map((finding) => ({ ...finding })),
      ),
    );
  }
  const quickHitSubmission = submissions.get("QUICK_HIT_PACKAGE");
  if (quickHitSubmission) {
    const validation = validateQuickHitGrounding(
      quickHitPackageSchema.parse(quickHitSubmission.payload),
      serverClaims,
      quoteProvenance,
    );
    packageGroundingResults.push(
      result(
        quickHitSubmission,
        "GROUNDING",
        validation.findings.map((finding) => ({ ...finding })),
      ),
    );
  }

  const factClaimIds = new Set(factCheck.claimResults.map((claim) => claim.claimId));
  const factCheckFindings: Array<Record<string, unknown>> = [];
  if (!factCheck.passed) factCheckFindings.push({ code: "FACT_CHECK_REPORTED_FAILURE" });
  if (factCheckSubmission.workItemId === draftSubmission.workItemId) {
    factCheckFindings.push({ code: "FACT_CHECK_NOT_INDEPENDENT" });
  }
  if (factCheckSubmission.workerId === draftSubmission.workerId) {
    factCheckFindings.push({ code: "FACT_CHECK_WORKER_NOT_INDEPENDENT" });
  }
  if (
    factCheckSubmission.workItemKind !== "FACT_CHECK" ||
    factCheck.independentRunId !== factCheckSubmission.workItemId
  ) {
    factCheckFindings.push({ code: "FACT_CHECK_RUN_ID_INVALID" });
  }
  if (factCheck.draftPayloadHash !== draftSubmission.payloadHash) {
    factCheckFindings.push({ code: "FACT_CHECK_DRAFT_HASH_MISMATCH" });
  }
  if (factCheck.evidenceSnapshotHash !== draftSubmission.inputSnapshotHash) {
    factCheckFindings.push({ code: "FACT_CHECK_EVIDENCE_HASH_MISMATCH" });
  }
  for (const claim of claimMap.claims) {
    if (!factClaimIds.has(claim.claimId)) {
      factCheckFindings.push({ code: "FACT_CHECK_MISSING_CLAIM", claimId: claim.claimId });
    }
  }
  for (const claimResult of factCheck.claimResults) {
    const mappedClaim = claimMap.claims.find(
      (claim) => claim.claimId === claimResult.claimId,
    );
    for (const evidenceId of claimResult.evidenceRecordIds) {
      if (
        !evidenceById.has(evidenceId) ||
        !mappedClaim?.evidenceRecordIds.includes(evidenceId)
      ) {
        factCheckFindings.push({
          code: "FACT_CHECK_EVIDENCE_MISMATCH",
          claimId: claimResult.claimId,
          evidenceId,
        });
      }
    }
  }
  if (factCheck.claimResults.some((claim) => !claim.passed)) {
    factCheckFindings.push({ code: "FACT_CHECK_CLAIM_FAILED" });
  }

  const safeRights = new Set(["OFFICIAL_EMBEDDABLE", "OWNED", "LICENSED"]);
  const rightsFindings: Array<Record<string, unknown>> = safeRights.has(
    context.candidate.mediaRightsStatus,
  )
    ? []
    : [{ code: "MEDIA_RIGHTS_NOT_APPROVED" }];

  for (const kind of ["PRIMARY_VIDEO_PACKAGE", "QUICK_HIT_PACKAGE"] as const) {
    const submission = submissions.get(kind);
    if (!submission) continue;
    const visualRights =
      kind === "PRIMARY_VIDEO_PACKAGE"
        ? primaryVideoPackageSchema.parse(submission.payload).shotList.map(
            (shot) => shot.visual.rightsClassification,
          )
        : quickHitPackageSchema.parse(submission.payload).visualSequence.map(
            (visual) => visual.rightsClassification,
          );
    if (visualRights.some((rights) => !safeRights.has(rights))) {
      rightsFindings.push({ code: "PACKAGE_MEDIA_RIGHTS_NOT_APPROVED", kind });
    }
  }

  const seoFindings: Array<Record<string, unknown>> = [];
  if (seo.duplicateContentAssessment.risk !== "LOW") {
    seoFindings.push({ code: "SEO_DUPLICATE_CONTENT_RISK" });
  }
  if (seo.canonicalPath !== `/news/${seo.stableSlug}`) {
    seoFindings.push({ code: "SEO_CANONICAL_PATH_MISMATCH" });
  }
  if (seo.internalLinks.some((link) => !link.pageExists)) {
    seoFindings.push({ code: "SEO_BROKEN_INTERNAL_LINK" });
  }

  const results = [
    result(claimSubmission, "CLAIM_EVIDENCE", [...bundleFindings, ...claimFindings]),
    result(claimSubmission, "QUOTE_PROVENANCE", quoteFindings),
    result(
      draftSubmission,
      "GROUNDING",
      grounding.findings.map((finding) => ({ ...finding })),
    ),
    result(factCheckSubmission, "FACT_CHECK", factCheckFindings),
    result(draftSubmission, "COPYRIGHT", rightsFindings),
    result(seoSubmission, "SEO", seoFindings),
    ...packageGroundingResults,
  ];

  return { complete: true as const, missing: [] as string[], results };
}
