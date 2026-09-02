export type ModelPrice = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export function estimateGenerationCostMicros(
  price: ModelPrice,
  usage: { inputTokens: number; outputTokens: number },
) {
  const inputRateMicros = Math.round(price.inputUsdPerMillion * 1_000_000);
  const outputRateMicros = Math.round(price.outputUsdPerMillion * 1_000_000);
  return Math.ceil(
    (usage.inputTokens * inputRateMicros + usage.outputTokens * outputRateMicros) /
      1_000_000,
  );
}

export const phase5CostModel = {
  research: { inputTokens: 24_000, outputTokens: 5_000 },
  article: { inputTokens: 16_000, outputTokens: 4_000 },
  seoAndContentPackages: { inputTokens: 10_000, outputTokens: 4_000 },
} as const;

export function estimatedCandidateCosts(price: ModelPrice) {
  const researchMicros = estimateGenerationCostMicros(price, phase5CostModel.research);
  const articleMicros = estimateGenerationCostMicros(price, phase5CostModel.article);
  const packagesMicros = estimateGenerationCostMicros(price, phase5CostModel.seoAndContentPackages);
  return {
    researchUsd: researchMicros / 1_000_000,
    articleUsd: articleMicros / 1_000_000,
    fullPackageUsd: (researchMicros + articleMicros + packagesMicros) / 1_000_000,
  };
}
