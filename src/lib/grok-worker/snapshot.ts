import { hashPayload } from "./crypto";

export type GrokCandidateSnapshot = {
  candidate: {
    id: string;
    status: string;
    duplicateStatus: string;
    verificationRecommendation: string;
    confidenceScore: number;
    conflictingClaims: Array<Record<string, unknown>>;
    mediaRightsStatus: string;
    sourceUrl: string;
  };
  source: {
    id: string;
    authorityTier: string;
    isFirstParty: boolean;
    url: string;
  };
  evidence: Array<{
    id: string;
    sourceId: string | null;
    sourceUrl: string;
    authorityTier: string;
    extractedFacts: string[];
    exactQuotes: Array<Record<string, unknown>>;
    rightsNotes: string | null;
    updatedAt: Date;
  }>;
};

export function grokCandidateSnapshotHash(snapshot: GrokCandidateSnapshot) {
  return hashPayload(snapshot);
}
