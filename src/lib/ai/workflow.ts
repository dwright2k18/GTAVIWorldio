export const aiDraftStatuses = ["DRAFTING", "FACT_CHECK", "NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;
export type AiDraftStatus = (typeof aiDraftStatuses)[number];

const allowedTransitions: Record<AiDraftStatus, AiDraftStatus[]> = {
  DRAFTING: ["FACT_CHECK", "NEEDS_REVIEW", "REJECTED"],
  FACT_CHECK: ["DRAFTING", "NEEDS_REVIEW", "REJECTED"],
  NEEDS_REVIEW: ["DRAFTING", "FACT_CHECK", "APPROVED", "REJECTED"],
  APPROVED: ["DRAFTING", "REJECTED"],
  REJECTED: ["DRAFTING"],
};

export function assertAiDraftTransition(
  from: AiDraftStatus,
  to: AiDraftStatus,
  options: { groundingPassed: boolean },
) {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`AI drafts cannot move from ${from} to ${to}.`);
  }
  if (["NEEDS_REVIEW", "APPROVED"].includes(to) && !options.groundingPassed) {
    throw new Error("Grounding must pass before an AI draft can move to NEEDS_REVIEW or APPROVED.");
  }
  return to;
}

export function assertPrivateAiOutputStatus(status: string) {
  if (["SCHEDULED", "PUBLISHED", "UPDATED"].includes(status)) {
    throw new Error("AI output cannot schedule or publish content.");
  }
}
