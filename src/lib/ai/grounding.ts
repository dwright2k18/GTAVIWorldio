import type { ArticleDraft, ResearchClaim } from "./schemas";

export type GroundingFinding = {
  code:
    | "UNKNOWN_CLAIM"
    | "UNAPPROVED_CLAIM"
    | "CONTRADICTED_CLAIM"
    | "QUOTE_WITHOUT_PROVENANCE"
    | "UNSUPPORTED_DATE"
    | "UNSUPPORTED_SENSITIVE_CLAIM"
    | "VERIFICATION_OVERSTATEMENT";
  location: string;
  detail: string;
};

const sensitiveClaimPattern = /\b(release date|platform|price|pre-?order|gameplay|map|character|developer)\b/i;
const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s+\d{4})?|\b\d{4}-\d{2}-\d{2}\b/g;
const quotePattern = /[“"]([^”"]{2,600})[”"]/g;
const verificationStrength = {
  SPECULATION: 0,
  ALLEGED_LEAK: 1,
  RUMOR: 2,
  CREDIBLE_REPORT: 3,
  CONFIRMED: 4,
} as const;

type QuoteProvenance = {
  exactText: string;
  claimId: string;
  evidenceId: string;
};

export function validateDraftGrounding(
  draft: ArticleDraft,
  claims: ResearchClaim[],
  quotes: QuoteProvenance[],
) {
  const findings: GroundingFinding[] = [];
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  const blocks = [
    ...draft.introduction.map((block, index) => ({ ...block, location: `introduction.${index}` })),
    ...draft.bodySections.flatMap((section, sectionIndex) =>
      section.paragraphs.map((block, index) => ({ ...block, location: `body.${sectionIndex}.${index}` })),
    ),
    ...draft.whyItMatters.map((block, index) => ({ ...block, location: `whyItMatters.${index}` })),
    ...draft.confirmedFacts.map((block, index) => ({ ...block, location: `confirmedFacts.${index}` })),
    ...draft.necessaryContext.map((block, index) => ({ ...block, location: `context.${index}` })),
  ];

  for (const block of blocks) {
    const referencedClaims = block.claimIds.map((id) => claimById.get(id));
    for (let index = 0; index < block.claimIds.length; index += 1) {
      const claimId = block.claimIds[index];
      const claim = referencedClaims[index];
      if (!claim) {
        findings.push({ code: "UNKNOWN_CLAIM", location: block.location, detail: `Claim ${claimId} is not in the research packet.` });
      } else if (claim.editorReviewStatus !== "APPROVED") {
        findings.push({ code: "UNAPPROVED_CLAIM", location: block.location, detail: `Claim ${claimId} has not been approved.` });
      } else if (claim.contradictionStatus !== "NONE") {
        findings.push({ code: "CONTRADICTED_CLAIM", location: block.location, detail: `Claim ${claimId} has an unresolved contradiction.` });
      }
    }

    const supportText = referencedClaims.filter(Boolean).map((claim) => claim!.claimText).join(" ").toLowerCase();
    const blockDates = block.text.match(datePattern) ?? [];
    for (const date of blockDates) {
      if (!supportText.includes(date.toLowerCase())) {
        findings.push({ code: "UNSUPPORTED_DATE", location: block.location, detail: `Date “${date}” is not present in the referenced claim text.` });
      }
    }
    if (sensitiveClaimPattern.test(block.text) && !referencedClaims.some((claim) => claim?.editorReviewStatus === "APPROVED")) {
      findings.push({ code: "UNSUPPORTED_SENSITIVE_CLAIM", location: block.location, detail: "A release, platform, pricing, gameplay, map, character, or developer statement lacks an approved claim." });
    }
    for (const match of block.text.matchAll(quotePattern)) {
      const exactText = match[1];
      const provenance = quotes.find((quote) => quote.exactText === exactText && block.claimIds.includes(quote.claimId));
      if (!provenance) {
        findings.push({ code: "QUOTE_WITHOUT_PROVENANCE", location: block.location, detail: `Quoted text “${exactText}” has no exact stored provenance.` });
      }
    }
  }

  const strongestReferenced = claims
    .filter((claim) => claim.includedInDraft)
    .reduce((strength, claim) => Math.max(strength, verificationStrength[claim.verificationStatus]), 0);
  if (verificationStrength[draft.verificationStatus] > strongestReferenced) {
    findings.push({ code: "VERIFICATION_OVERSTATEMENT", location: "verificationStatus", detail: "Draft verification language is stronger than the included evidence allows." });
  }

  return {
    passed: findings.length === 0,
    nextStatus: findings.length === 0 ? "NEEDS_REVIEW" as const : "FACT_CHECK" as const,
    findings,
  };
}
