import { canonicalizeSourceUrl, jaccardSimilarity, normalizeHeadline } from "./normalize";
import type { DuplicateAssessment } from "./types";

export type ExistingCandidateFingerprint = {
  id: string;
  canonicalUrl: string;
  normalizedTitle: string;
  contentHash: string;
  sourcePublishedAt?: Date | null;
};

export function assessDuplicate(
  candidate: {
    canonicalUrl: string;
    title: string;
    contentHash: string;
    publishedAt?: Date;
  },
  existing: ExistingCandidateFingerprint[],
): DuplicateAssessment {
  const normalizedUrl = canonicalizeSourceUrl(candidate.canonicalUrl);
  const normalizedTitle = normalizeHeadline(candidate.title);

  for (const record of existing) {
    if (record.contentHash === candidate.contentHash) {
      return { status: "DUPLICATE", similarity: 1, reason: "Exact content hash match.", matchingCandidateId: record.id };
    }
    if (canonicalizeSourceUrl(record.canonicalUrl) === normalizedUrl) {
      return { status: "RELATED", similarity: 1, reason: "The same canonical page changed meaningfully and belongs to the existing event history.", matchingCandidateId: record.id };
    }
  }

  let best: { record: ExistingCandidateFingerprint; similarity: number } | null = null;
  for (const record of existing) {
    const similarity = jaccardSimilarity(normalizedTitle, record.normalizedTitle);
    if (!best || similarity > best.similarity) best = { record, similarity };
  }

  if (!best) return { status: "NEW_STORY", similarity: 0, reason: "No existing candidate fingerprints." };
  const hoursApart = candidate.publishedAt && best.record.sourcePublishedAt
    ? Math.abs(candidate.publishedAt.valueOf() - best.record.sourcePublishedAt.valueOf()) / 3_600_000
    : Number.POSITIVE_INFINITY;
  if (best.similarity >= 0.82 && hoursApart <= 72) {
    return { status: "LIKELY_DUPLICATE", similarity: best.similarity, reason: "Highly similar headline within the same reporting window.", matchingCandidateId: best.record.id };
  }
  if (best.similarity >= 0.5) {
    return { status: "RELATED", similarity: best.similarity, reason: "Overlapping topic language suggests a related event.", matchingCandidateId: best.record.id };
  }
  return { status: "NEW_STORY", similarity: best.similarity, reason: "No strong duplicate or relationship signal." };
}

export function clusterEventKey(title: string) {
  const stopWords = new Set(["about", "after", "from", "into", "latest", "says", "that", "their", "this", "with"]);
  return normalizeHeadline(title)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token))
    .slice(0, 10)
    .sort()
    .join("-");
}
