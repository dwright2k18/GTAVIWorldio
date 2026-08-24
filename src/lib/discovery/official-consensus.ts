import { assessDuplicate, clusterEventKey, eventSignature, type ExistingCandidateFingerprint } from "./deduplication";
import { canonicalizeSourceUrl, jaccardSimilarity, normalizeHeadline } from "./normalize";
import type { DuplicateAssessment } from "./types";

export type OfficialSignalKind = "NEWSWIRE" | "YOUTUBE" | "KNOWN_PAGE" | "TAKE_TWO";

export type OfficialSignal = {
  sourceId: string;
  kind: OfficialSignalKind;
  title: string;
  url: string;
  contentHash: string;
  publishedAt?: Date;
};

export type KnownOfficialUrlSets = {
  sourceUrls?: Iterable<string>;
  evidenceUrls?: Iterable<string>;
  candidateUrls?: Iterable<string>;
  storyUrls?: Iterable<string>;
};

export type OfficialUrlClassification = "NEW" | "KNOWN" | "RELATED" | "DUPLICATE";

function normalizedSet(values: Iterable<string> | undefined) {
  return new Set([...(values ?? [])].map((value) => canonicalizeSourceUrl(value)));
}

export function classifyOfficialUrl(
  value: string,
  known: KnownOfficialUrlSets,
  eventAssessment?: DuplicateAssessment,
): { canonicalUrl: string; classification: OfficialUrlClassification; reason: string } {
  const canonicalUrl = canonicalizeSourceUrl(value);
  const sources = normalizedSet(known.sourceUrls);
  const evidence = normalizedSet(known.evidenceUrls);
  const candidates = normalizedSet(known.candidateUrls);
  const stories = normalizedSet(known.storyUrls);

  if (evidence.has(canonicalUrl) || candidates.has(canonicalUrl) || stories.has(canonicalUrl)) {
    return { canonicalUrl, classification: "DUPLICATE", reason: "The canonical URL is already attached to newsroom content or evidence." };
  }
  if (sources.has(canonicalUrl)) {
    return { canonicalUrl, classification: "KNOWN", reason: "The canonical URL is already registered as a monitored source." };
  }
  if (eventAssessment && eventAssessment.status !== "NEW_STORY") {
    return {
      canonicalUrl,
      classification: eventAssessment.status === "DUPLICATE" ? "DUPLICATE" : "RELATED",
      reason: eventAssessment.reason,
    };
  }
  return { canonicalUrl, classification: "NEW", reason: "No normalized URL or event match exists." };
}

export function officialReferencesFromMetadata(metadata: Record<string, unknown>) {
  const values = metadata.referencedOfficialUrls;
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => canonicalizeSourceUrl(value)))]
    .sort();
}

export function resolveOfficialSignalEvents(
  signals: OfficialSignal[],
  existing: ExistingCandidateFingerprint[] = [],
) {
  const events: Array<{
    eventKey: string;
    title: string;
    evidence: OfficialSignal[];
    candidateDecision: DuplicateAssessment;
  }> = [];

  for (const signal of signals) {
    const normalizedTitle = normalizeHeadline(signal.title);
    const matched = events.find((event) =>
      event.eventKey === eventSignature(signal.title)
      || jaccardSimilarity(event.title, normalizedTitle) >= 0.5,
    );
    if (matched) {
      if (!matched.evidence.some((entry) => canonicalizeSourceUrl(entry.url) === canonicalizeSourceUrl(signal.url))) {
        matched.evidence.push(signal);
      }
      continue;
    }
    events.push({
      eventKey: eventSignature(signal.title) || clusterEventKey(signal.title) || signal.contentHash.slice(0, 24),
      title: signal.title,
      evidence: [signal],
      candidateDecision: assessDuplicate({
        canonicalUrl: signal.url,
        title: signal.title,
        contentHash: signal.contentHash,
        publishedAt: signal.publishedAt,
      }, existing),
    });
  }

  return events.map((event) => ({
    ...event,
    evidence: [...event.evidence].sort((left, right) =>
      `${left.kind}:${canonicalizeSourceUrl(left.url)}`.localeCompare(`${right.kind}:${canonicalizeSourceUrl(right.url)}`),
    ),
  }));
}

export type CoverageSignal = {
  label: "Newswire HTML" | "Official YouTube" | "Known pages" | "Take-Two";
  health: "HEALTHY" | "DEGRADED" | "FAILED" | "NOT_CHECKED" | "CIRCUIT_OPEN";
  lastSuccessfulExtractionAt?: Date | null;
  lastDiscoveredItemAt?: Date | null;
};

export function overallRockstarCoverage(signals: CoverageSignal[]) {
  const rockstarSignals = signals.filter((signal) => signal.label !== "Take-Two");
  const healthyAlternates = rockstarSignals.filter((signal) => signal.label !== "Newswire HTML" && signal.health === "HEALTHY").length;
  const newswire = rockstarSignals.find((signal) => signal.label === "Newswire HTML");
  if (newswire?.health === "HEALTHY" && healthyAlternates >= 1) return "OPERATIONAL" as const;
  if (healthyAlternates >= 2) return "OPERATIONAL_WITH_DEGRADED_SIGNAL" as const;
  if (rockstarSignals.some((signal) => signal.health === "HEALTHY" || signal.health === "DEGRADED")) return "LIMITED" as const;
  return "BLIND" as const;
}

export function buildOfficialSourceGap(
  referencingUrl: string,
  unresolvedOfficialUrls: string[],
) {
  const urls = [...new Set(unresolvedOfficialUrls.map((value) => canonicalizeSourceUrl(value)))].sort();
  if (!urls.length) return null;
  return {
    alertType: "OFFICIAL_SOURCE_GAP" as const,
    priority: 78,
    title: "Possible Rockstar coverage gap",
    detail: `An official signal at ${canonicalizeSourceUrl(referencingUrl)} references ${urls.join(", ")}, but the primary source could not be resolved or extracted.`,
    urls,
  };
}
