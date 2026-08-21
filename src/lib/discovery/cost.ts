export const safeStartingLimits = {
  maxRequestsPerDay: 100,
  maxCandidatesPerRun: 20,
  maxAiTriageCallsPerDay: 0,
  maxAiResearchCallsPerDay: 0,
  maxEstimatedMonthlyCostCents: 0,
  retentionDays: 30,
} as const;

export function estimatedMonthlyRequests(options: {
  activeTier1: number;
  activeTier2: number;
  activeTier3: number;
}) {
  const daily = options.activeTier1 * 24 + options.activeTier2 * 8 + options.activeTier3 * 2;
  return Math.min(daily, safeStartingLimits.maxRequestsPerDay) * 30;
}
export function canUseDeepResearch(options: {
  enabled: boolean;
  callsToday: number;
  dailyLimit: number;
  estimatedMonthlyCostCents: number;
  monthlyLimitCents: number;
}) {
  return (
    options.enabled &&
    options.dailyLimit > 0 &&
    options.callsToday < options.dailyLimit &&
    options.monthlyLimitCents > 0 &&
    options.estimatedMonthlyCostCents < options.monthlyLimitCents
  );
}
