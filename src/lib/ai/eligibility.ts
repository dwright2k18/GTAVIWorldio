export type CandidateEligibilityInput = {
  sourceIsFirstParty: boolean;
  sourceAuthorityTier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
  verificationRecommendation: string;
  confidenceScore: number;
  duplicateStatus: string;
  candidateStatus: string;
  unresolvedSourceGapCount: number;
  evidenceCount: number;
  officialEvidenceCount: number;
  storyId: string | null;
};

export function evaluateCandidateEligibility(input: CandidateEligibilityInput) {
  const reasons: string[] = [];
  if (!input.sourceIsFirstParty || input.sourceAuthorityTier !== "TIER_1") {
    reasons.push("Only Tier 1 first-party official sources are eligible.");
  }
  if (!(["CONFIRMED", "CREDIBLE_REPORT"] as string[]).includes(input.verificationRecommendation)) {
    reasons.push("Verification recommendation is not eligible for the initial pilot.");
  }
  if (input.confidenceScore < 90) reasons.push("Confidence must be at least 90.");
  if (input.duplicateStatus !== "NEW_STORY") reasons.push("Duplicate or related candidates are not eligible.");
  if (["DUPLICATE", "REJECTED", "PROMOTED_TO_STORY", "ARCHIVED"].includes(input.candidateStatus)) {
    reasons.push("Candidate status is not eligible.");
  }
  if (input.unresolvedSourceGapCount > 0) reasons.push("An unresolved official-source gap is active.");
  if (input.evidenceCount < 1 || input.officialEvidenceCount < 1) reasons.push("Sufficient official evidence is required.");
  if (input.storyId) reasons.push("An equivalent story already exists.");
  return { eligible: reasons.length === 0, reasons };
}

export type AiBudgetSettings = {
  enabled: boolean;
  emergencyStop: boolean;
  dailyCallLimit: number;
  dailyInputTokenLimit: number;
  dailyOutputTokenLimit: number;
  dailyCostLimitMicros: number;
  perCandidateCallLimit: number;
  perCandidateCostLimitMicros: number;
  maxRegenerations: number;
};

export type AiBudgetUsage = {
  dailyCalls: number;
  dailyInputTokens: number;
  dailyOutputTokens: number;
  dailyCostMicros: number;
  candidateCalls: number;
  candidateCostMicros: number;
  candidateRegenerations: number;
};

export function evaluateAiBudget(
  settings: AiBudgetSettings,
  usage: AiBudgetUsage,
  predicted: { inputTokens: number; outputTokens: number; costMicros: number },
) {
  const reasons: string[] = [];
  if (!settings.enabled) reasons.push("PROVIDER_DISABLED");
  if (settings.emergencyStop) reasons.push("EMERGENCY_STOP");
  if (settings.dailyCallLimit <= 0 || usage.dailyCalls + 1 > settings.dailyCallLimit) reasons.push("DAILY_CALL_LIMIT");
  if (settings.dailyInputTokenLimit <= 0 || usage.dailyInputTokens + predicted.inputTokens > settings.dailyInputTokenLimit) reasons.push("DAILY_INPUT_TOKEN_LIMIT");
  if (settings.dailyOutputTokenLimit <= 0 || usage.dailyOutputTokens + predicted.outputTokens > settings.dailyOutputTokenLimit) reasons.push("DAILY_OUTPUT_TOKEN_LIMIT");
  if (settings.dailyCostLimitMicros <= 0 || usage.dailyCostMicros + predicted.costMicros > settings.dailyCostLimitMicros) reasons.push("DAILY_COST_LIMIT");
  if (settings.perCandidateCallLimit <= 0 || usage.candidateCalls + 1 > settings.perCandidateCallLimit) reasons.push("CANDIDATE_CALL_LIMIT");
  if (settings.perCandidateCostLimitMicros <= 0 || usage.candidateCostMicros + predicted.costMicros > settings.perCandidateCostLimitMicros) reasons.push("CANDIDATE_COST_LIMIT");
  if (usage.candidateRegenerations > settings.maxRegenerations) reasons.push("REGENERATION_LIMIT");
  return { allowed: reasons.length === 0, reasons };
}
