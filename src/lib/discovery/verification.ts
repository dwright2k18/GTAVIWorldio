import type { DiscoverySource, VerificationRecommendation } from "./types";

export function recommendVerification(
  source: DiscoverySource,
  options: { directEvidence: boolean; title: string; summary?: string },
): VerificationRecommendation {
  const claim = `${options.title} ${options.summary ?? ""}`.toLowerCase();

  if (source.authorityTier === "TIER_4") return "ALLEGED_LEAK";
  if (/\b(?:leak|leaked|hacked|stolen build)\b/.test(claim)) return "ALLEGED_LEAK";
  if (source.authorityTier === "TIER_1" && source.isFirstParty && options.directEvidence) {
    return "CONFIRMED";
  }
  if (source.authorityTier === "TIER_2") return "CREDIBLE_REPORT";
  if (/\b(?:rumor|reportedly|unconfirmed|claim)\b/.test(claim)) return "RUMOR";
  return "SPECULATION";
}
export function confidenceScore(
  source: DiscoverySource,
  options: {
    directEvidence: boolean;
    independentSourceCount: number;
    contradictoryClaims?: number;
    ageHours?: number;
  },
) {
  let score = source.reliabilityScore * 0.55;
  score += options.directEvidence ? 30 : 0;
  score += Math.min(options.independentSourceCount, 3) * 7;
  score -= Math.min(options.contradictoryClaims ?? 0, 3) * 12;
  if ((options.ageHours ?? 0) > 168 && !options.directEvidence) score -= 8;
  return clampScore(score);
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
