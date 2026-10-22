import type {
  ArticleDraft,
  PrimaryVideoPackage,
  QuickHitPackage,
  ResearchClaim,
} from "./schemas";

export type GroundingFinding = {
  code:
    | "UNKNOWN_CLAIM"
    | "UNAPPROVED_CLAIM"
    | "CONTRADICTED_CLAIM"
    | "QUOTE_WITHOUT_PROVENANCE"
    | "UNKNOWN_EVIDENCE"
    | "MISSING_CLAIM_EVIDENCE"
    | "UNSUPPORTED_DATE"
    | "UNSUPPORTED_ENTITY"
    | "UNSUPPORTED_STATEMENT"
    | "UNSUPPORTED_SENSITIVE_CLAIM"
    | "VERIFICATION_OVERSTATEMENT";
  location: string;
  detail: string;
};

const sensitiveClaimPattern = /\b(release date|platform|price|pre-?order|gameplay|map|character|developer)\b/i;
const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s+\d{4})?|\b\d{4}-\d{2}-\d{2}\b/g;
const quotePattern = /[“"]([^”"]{2,600})[”"]/g;
const numberPattern = /\b\d+(?:[.,]\d+)?%?\b/g;
const entityPattern = /\b(?:[A-Z][A-Za-z0-9'-]{1,}|[A-Z]{2,})\b/g;
const sentenceStartWords = new Set(["A", "An", "And", "But", "For", "How", "If", "In", "It", "The", "This", "What", "When", "Where", "Which", "Who", "Why"]);
const safeEngagementPrompts = new Set([
  "what stood out to you",
  "what do you think",
  "which detail stood out to you",
  "how do you feel",
  "would you like to see more",
  "tell us what you think",
  "share your thoughts",
]);
const verificationStrength = {
  SPECULATION: 0,
  ALLEGED_LEAK: 1,
  RUMOR: 2,
  CREDIBLE_REPORT: 3,
  CONFIRMED: 4,
} as const;

export type QuoteProvenance = {
  exactText: string;
  claimId: string;
  evidenceId: string;
};

type SourcedStatement = {
  text: string;
  claimIds: string[];
  location: string;
};

function normalizedWords(value: string) {
  return value.normalize("NFKD").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function normalizedText(value: string) {
  return normalizedWords(value).join(" ");
}

function splitStatements(value: string) {
  return value
    .split(/(?<=[.!?])\s+|[\r\n]+/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function isSafeEngagementPrompt(statement: string) {
  return safeEngagementPrompts.has(normalizedText(statement));
}

function validReferencedClaims(
  statement: SourcedStatement,
  claimById: Map<string, ResearchClaim>,
  findings: GroundingFinding[],
) {
  return statement.claimIds.flatMap((claimId) => {
    const claim = claimById.get(claimId);
    if (!claim) {
      findings.push({ code: "UNKNOWN_CLAIM", location: statement.location, detail: `Claim ${claimId} is not in the research packet.` });
      return [];
    }
    if (claim.editorReviewStatus !== "APPROVED") {
      findings.push({ code: "UNAPPROVED_CLAIM", location: statement.location, detail: `Claim ${claimId} has not been approved.` });
      return [];
    }
    if (claim.contradictionStatus !== "NONE") {
      findings.push({ code: "CONTRADICTED_CLAIM", location: statement.location, detail: `Claim ${claimId} has an unresolved contradiction.` });
      return [];
    }
    return [claim];
  });
}

function validateSourcedStatements(
  statements: SourcedStatement[],
  claims: ResearchClaim[],
  quotes: QuoteProvenance[] = [],
) {
  const findings: GroundingFinding[] = [];
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));

  for (const sourced of statements) {
    const referencedClaims = validReferencedClaims(sourced, claimById, findings);
    const referencedQuotes = quotes.filter((quote) => sourced.claimIds.includes(quote.claimId));
    const supportText = [
      ...referencedClaims.map((claim) => claim.claimText),
      ...referencedQuotes.map((quote) => quote.exactText),
    ].join(" ");
    const normalizedClaims = referencedClaims.map((claim) => normalizedText(claim.claimText));

    for (const date of sourced.text.match(datePattern) ?? []) {
      if (!supportText.toLowerCase().includes(date.toLowerCase())) {
        findings.push({ code: "UNSUPPORTED_DATE", location: sourced.location, detail: `Date “${date}” is not present in the referenced claim text.` });
      }
    }
    if (sensitiveClaimPattern.test(sourced.text) && !referencedClaims.length) {
      findings.push({ code: "UNSUPPORTED_SENSITIVE_CLAIM", location: sourced.location, detail: "A release, platform, pricing, gameplay, map, character, or developer statement lacks a usable approved claim." });
    }
    for (const match of sourced.text.matchAll(quotePattern)) {
      const exactText = match[1];
      const provenance = quotes.find((quote) => quote.exactText === exactText && sourced.claimIds.includes(quote.claimId));
      if (!provenance) {
        findings.push({ code: "QUOTE_WITHOUT_PROVENANCE", location: sourced.location, detail: `Quoted text “${exactText}” has no exact stored provenance.` });
      }
    }

    for (const statement of splitStatements(sourced.text)) {
      if (isSafeEngagementPrompt(statement)) continue;
      const statementNormalized = normalizedText(statement);
      if (!statementNormalized) continue;
      const exactClaimSupport = normalizedClaims.includes(statementNormalized);
      const exactQuoteSupport = referencedQuotes.some((quote) => normalizedText(quote.exactText) === statementNormalized);
      if (!referencedClaims.length || (!exactClaimSupport && !exactQuoteSupport)) {
        findings.push({
          code: "UNSUPPORTED_STATEMENT",
          location: sourced.location,
          detail: `Statement “${statement}” is not an exact approved claim or stored quotation. Paraphrases require human fact-check review.`,
        });
      }

      const unsupportedEntities = [...new Set(statement.match(entityPattern) ?? [])]
        .filter((entity) => !sentenceStartWords.has(entity))
        .filter((entity) => !supportText.toLowerCase().includes(entity.toLowerCase()));
      const unsupportedNumbers = [...new Set(statement.match(numberPattern) ?? [])]
        .filter((number) => !supportText.includes(number));
      const unsupportedAnchors = [...unsupportedEntities, ...unsupportedNumbers];
      if (unsupportedAnchors.length) {
        findings.push({
          code: "UNSUPPORTED_ENTITY",
          location: sourced.location,
          detail: `Named or numeric detail is absent from the referenced claims: ${unsupportedAnchors.join(", ")}.`,
        });
      }
    }
  }

  return findings;
}

function allUsableClaimIds(claims: ResearchClaim[]) {
  return claims
    .filter((claim) => claim.editorReviewStatus === "APPROVED" && claim.contradictionStatus === "NONE")
    .map((claim) => claim.claimId);
}

export function validateDraftGrounding(
  draft: ArticleDraft,
  claims: ResearchClaim[],
  quotes: QuoteProvenance[],
) {
  const allClaimIds = allUsableClaimIds(claims);
  const blocks: SourcedStatement[] = [
    { text: draft.workingHeadline, claimIds: allClaimIds, location: "workingHeadline" },
    { text: draft.dek, claimIds: allClaimIds, location: "dek" },
    { text: draft.summary, claimIds: allClaimIds, location: "summary" },
    ...draft.introduction.map((block, index) => ({ ...block, location: `introduction.${index}` })),
    ...draft.bodySections.flatMap((section, sectionIndex) => [
      { text: section.heading, claimIds: allClaimIds, location: `body.${sectionIndex}.heading` },
      ...section.paragraphs.map((block, index) => ({ ...block, location: `body.${sectionIndex}.${index}` })),
    ]),
    ...draft.whyItMatters.map((block, index) => ({ ...block, location: `whyItMatters.${index}` })),
    ...draft.confirmedFacts.map((block, index) => ({ ...block, location: `confirmedFacts.${index}` })),
    ...draft.necessaryContext.map((block, index) => ({ ...block, location: `context.${index}` })),
    ...draft.limitations.map((text, index) => ({ text, claimIds: allClaimIds, location: `limitations.${index}` })),
  ];
  const findings = validateSourcedStatements(blocks, claims, quotes);

  const referencedClaimIds = new Set(blocks.flatMap((block) => block.claimIds));
  const referencedClaims = claims.filter((claim) => referencedClaimIds.has(claim.claimId));
  const allowedEvidenceIds = new Set(referencedClaims.flatMap((claim) => claim.evidenceRecordIds));
  for (const evidenceId of draft.sourceEvidenceIds) {
    if (!allowedEvidenceIds.has(evidenceId)) {
      findings.push({ code: "UNKNOWN_EVIDENCE", location: "sourceEvidenceIds", detail: `Evidence ${evidenceId} is not attached to a referenced claim.` });
    }
  }
  for (const claim of referencedClaims) {
    if (!claim.evidenceRecordIds.some((evidenceId) => draft.sourceEvidenceIds.includes(evidenceId))) {
      findings.push({ code: "MISSING_CLAIM_EVIDENCE", location: "sourceEvidenceIds", detail: `Referenced claim ${claim.claimId} has no evidence ID in the draft provenance list.` });
    }
  }
  const weakestReferenced = claims
    .filter((claim) => referencedClaimIds.has(claim.claimId))
    .reduce<number>((strength, claim) => Math.min(strength, verificationStrength[claim.verificationStatus]), verificationStrength.CONFIRMED);
  if (verificationStrength[draft.verificationStatus] > weakestReferenced) {
    findings.push({ code: "VERIFICATION_OVERSTATEMENT", location: "verificationStatus", detail: "Draft verification language is stronger than the included evidence allows." });
  }

  return {
    passed: findings.length === 0,
    nextStatus: findings.length === 0 ? "NEEDS_REVIEW" as const : "FACT_CHECK" as const,
    findings,
  };
}

export function validatePrimaryVideoGrounding(
  content: PrimaryVideoPackage,
  claims: ResearchClaim[],
  quotes: QuoteProvenance[] = [],
) {
  const allClaimIds = allUsableClaimIds(claims);
  const statements: SourcedStatement[] = [
    ...content.hookOptions.map((text, index) => ({ text, claimIds: allClaimIds, location: `hookOptions.${index}` })),
    { text: content.recommendedHook, claimIds: allClaimIds, location: "recommendedHook" },
    ...content.timedVoiceover.map((line, index) => ({ text: line.text, claimIds: line.claimIds, location: `timedVoiceover.${index}` })),
    ...content.shotList.map((shot, index) => ({ text: `${shot.onScreenText} ${shot.caption}`.trim(), claimIds: allClaimIds, location: `shotList.${index}` })),
    { text: content.tiktok.title, claimIds: allClaimIds, location: "tiktok.title" },
    { text: content.tiktok.caption, claimIds: allClaimIds, location: "tiktok.caption" },
    { text: content.youtubeShorts.title, claimIds: allClaimIds, location: "youtubeShorts.title" },
    { text: content.youtubeShorts.description, claimIds: allClaimIds, location: "youtubeShorts.description" },
    { text: content.instagramCaption, claimIds: allClaimIds, location: "instagramCaption" },
    { text: content.facebookCaption, claimIds: allClaimIds, location: "facebookCaption" },
    { text: content.viewerQuestion, claimIds: allClaimIds, location: "viewerQuestion" },
  ].filter((statement) => statement.text.length > 0);
  const findings = validateSourcedStatements(statements, claims, quotes);
  return { passed: findings.length === 0, findings };
}

export function validateQuickHitGrounding(
  content: QuickHitPackage,
  claims: ResearchClaim[],
  quotes: QuoteProvenance[] = [],
) {
  const allClaimIds = allUsableClaimIds(claims);
  const statements: SourcedStatement[] = [
    ...content.timeline.map((line, index) => ({ text: line.voiceover, claimIds: line.claimIds, location: `timeline.${index}` })),
    ...content.onScreenText.map((text, index) => ({ text, claimIds: allClaimIds, location: `onScreenText.${index}` })),
    { text: content.caption, claimIds: allClaimIds, location: "caption" },
    ...Object.entries(content.platformTitleVariants).map(([platform, text]) => ({ text, claimIds: allClaimIds, location: `platformTitleVariants.${platform}` })),
    { text: content.relatedPrimaryVideoIdea, claimIds: allClaimIds, location: "relatedPrimaryVideoIdea" },
  ];
  const findings = validateSourcedStatements(statements, claims, quotes);
  return { passed: findings.length === 0, findings };
}
