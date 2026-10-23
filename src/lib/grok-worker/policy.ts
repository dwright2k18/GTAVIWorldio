export const GROK_PUBLICATION_POLICY_VERSION = "grok_publication_v1";

export type AutomaticPublicationInput = {
  sourceIsFirstParty: boolean;
  sourceActive: boolean;
  sourceAuthorityTier: string;
  candidateStatus: string;
  candidateIsTest: boolean;
  verificationStatus: string;
  confidenceScore: number;
  unresolvedSourceGapCount: number;
  hasConflictingEvidence: boolean;
  duplicateStatus: string;
  everyClaimHasEvidence: boolean;
  everyQuoteHasProvenance: boolean;
  groundingPassed: boolean;
  factCheckPassed: boolean;
  mediaRightsPassed: boolean;
  seoPassed: boolean;
  dailyPublicationCap: number;
  dailyPublicationCount: number;
  emergencyStop: boolean;
  apiEnabled: boolean;
  databaseAutoPublishEnabled: boolean;
  environmentAutoPublishEnabled: boolean;
  evidenceSnapshotMatches: boolean;
  independentFactCheckRun: boolean;
  defaultAuthorConfigured: boolean;
};

export type PublicationGate = {
  passed: boolean;
  reason: string;
};

export function evaluateAutomaticPublicationPolicy(
  input: AutomaticPublicationInput,
) {
  const gates: Record<string, PublicationGate> = {
    apiEnabled: {
      passed: input.apiEnabled,
      reason: "The private worker API must be explicitly enabled.",
    },
    environmentAutoPublishEnabled: {
      passed: input.environmentAutoPublishEnabled,
      reason: "The server-side GROK_AUTO_PUBLISH_ENABLED gate must be true.",
    },
    databaseAutoPublishEnabled: {
      passed: input.databaseAutoPublishEnabled,
      reason: "The database automatic-publication gate must be enabled.",
    },
    emergencyStopInactive: {
      passed: !input.emergencyStop,
      reason: "The emergency stop must be inactive.",
    },
    tierOneFirstParty: {
      passed:
        input.sourceIsFirstParty &&
        input.sourceActive &&
        input.sourceAuthorityTier === "TIER_1",
      reason: "Only Tier 1 first-party sources may be automatically published.",
    },
    candidateWorkflow: {
      passed:
        !input.candidateIsTest &&
        ["DISCOVERED", "TRIAGED", "RESEARCHING"].includes(
          input.candidateStatus,
        ),
      reason: "Test, rejected, duplicate, archived, or promoted candidates are ineligible.",
    },
    confirmed: {
      passed: input.verificationStatus === "CONFIRMED",
      reason: "Only CONFIRMED candidates may be automatically published.",
    },
    confidence: {
      passed: input.confidenceScore >= 95,
      reason: "Confidence must be at least 95.",
    },
    noSourceGap: {
      passed: input.unresolvedSourceGapCount === 0,
      reason: "No unresolved official-source gap may remain.",
    },
    noConflict: {
      passed: !input.hasConflictingEvidence,
      reason: "Conflicting evidence requires human review.",
    },
    notDuplicate: {
      passed: input.duplicateStatus === "NEW_STORY",
      reason: "Related or duplicate candidates cannot be automatically published.",
    },
    claimsGrounded: {
      passed: input.everyClaimHasEvidence,
      reason: "Every claim must map to accepted evidence.",
    },
    quotesProvenanced: {
      passed: input.everyQuoteHasProvenance,
      reason: "Every quotation must have exact provenance.",
    },
    grounding: {
      passed: input.groundingPassed,
      reason: "Server-side grounding validation must pass.",
    },
    factCheck: {
      passed: input.factCheckPassed && input.independentFactCheckRun,
      reason: "An independent fact-check run must pass.",
    },
    mediaRights: {
      passed: input.mediaRightsPassed,
      reason: "Copyright and media-rights validation must pass.",
    },
    seo: {
      passed: input.seoPassed,
      reason: "SEO and canonical validation must pass.",
    },
    evidenceSnapshot: {
      passed: input.evidenceSnapshotMatches,
      reason: "The validated evidence snapshot must still be current.",
    },
    publicationCap: {
      passed:
        input.dailyPublicationCap > 0 &&
        input.dailyPublicationCount < input.dailyPublicationCap,
      reason: "The daily automatic-publication cap must have capacity.",
    },
    authorConfigured: {
      passed: input.defaultAuthorConfigured,
      reason: "A real publication author must be configured.",
    },
  };

  const failed = Object.entries(gates)
    .filter(([, gate]) => !gate.passed)
    .map(([name, gate]) => ({ gate: name, reason: gate.reason }));

  return {
    policyVersion: GROK_PUBLICATION_POLICY_VERSION,
    eligible: failed.length === 0,
    gates,
    failed,
  };
}
