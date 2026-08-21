import type { ScoredCandidate } from "./types";

export type ResearchPacket = {
  headlineSuggestion: string;
  summary: string;
  knownFacts: ScoredCandidate["knownFacts"];
  uncertainties: string[];
  seoTitleSuggestion: string;
  metaDescriptionSuggestion: string;
  internalLinks: ScoredCandidate["internalLinks"];
  evergreen: ScoredCandidate["evergreen"];
  quickHitAngle: string;
  primaryVideoAngle: string;
  aiStatus: "NOT_REQUESTED" | "DISABLED" | "INSUFFICIENT_EVIDENCE";
};

export function buildSafeResearchPacket(candidate: ScoredCandidate): ResearchPacket {
  const hasEvidence = candidate.knownFacts.length > 0;
  const safeSummary = hasEvidence
    ? candidate.knownFacts.map(({ fact }) => fact).join(" ").slice(0, 500)
    : "INSUFFICIENT EVIDENCE";

  return {
    headlineSuggestion: candidate.item.title,
    summary: safeSummary,
    knownFacts: candidate.knownFacts,
    uncertainties: candidate.uncertainties,
    seoTitleSuggestion: candidate.item.title.slice(0, 70),
    metaDescriptionSuggestion: safeSummary.slice(0, 160),
    internalLinks: candidate.internalLinks,
    evergreen: candidate.evergreen,
    quickHitAngle: candidate.quickHitAngle,
    primaryVideoAngle: candidate.primaryVideoAngle,
    aiStatus: hasEvidence ? "NOT_REQUESTED" : "INSUFFICIENT_EVIDENCE",
  };
}
export class DisabledResearchProvider {
  readonly name = "disabled";

  async research() {
    return {
      status: "DISABLED" as const,
      message: "Deep AI research is disabled until a provider, budget, and explicit activation approval are configured.",
    };
  }
}
