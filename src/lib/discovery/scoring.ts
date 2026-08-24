import { detectEvergreenOpportunity, suggestedInternalLinks } from "./evergreen";
import { normalizeHeadline, sha256 } from "./normalize";
import { classifyMediaRights } from "./safety";
import { clampScore, recommendVerification } from "./verification";
import type {
  ConnectorItem,
  DiscoverySignals,
  DiscoverySource,
  ScoreBreakdowns,
  ScoreComponent,
  ScoredCandidate,
} from "./types";

export const DISCOVERY_SCORING_VERSION = "scoring_v1";

const topicRules = [
  ["release date", /\b(?:release date|delay|launch window|launch date)\b/i],
  ["trailer", /\b(?:trailer|footage|video premiere)\b/i],
  ["gameplay", /\b(?:gameplay|mechanic|combat|mission)\b/i],
  ["characters", /\b(?:lucia|jason|character)\b/i],
  ["map", /\b(?:map|vice city|leonida|location|world)\b/i],
  ["platforms", /\b(?:playstation|xbox|pc|platform)\b/i],
  ["pricing and preorders", /\b(?:price|pricing|preorder|pre-order)\b/i],
  ["online", /\b(?:online|multiplayer)\b/i],
  ["rumors", /\b(?:rumor|leak|claim|reportedly)\b/i],
] as const;

function topics(title: string, summary = "") {
  const haystack = `${title} ${summary}`;
  const found = topicRules.filter(([, pattern]) => pattern.test(haystack)).map(([topic]) => topic);
  return found.length ? found : ["GTA VI news"];
}
function keywordSuggestions(primaryTopic: string, title: string) {
  const base = ["GTA VI", "GTA 6"];
  if (primaryTopic !== "GTA VI news") base.push(`GTA VI ${primaryTopic}`);
  const names = title.match(/\b(?:Lucia|Jason|Vice City|Leonida|Rockstar|Take-Two)\b/gi) ?? [];
  return [...new Set([...base, ...names.map((name) => `GTA VI ${name}`)])].slice(0, 6);
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function stableScoringInputHash(value: unknown) {
  return sha256(JSON.stringify(stableValue(value)));
}

function component(key: string, label: string, value: number, reason: string): ScoreComponent {
  return { key, label, value, reason };
}

function total(components: ScoreComponent[]) {
  return clampScore(components.reduce((sum, entry) => sum + entry.value, 0));
}

function sourceAuthorityComponents(source: DiscoverySource) {
  const tierBase = { TIER_1: 70, TIER_2: 55, TIER_3: 35, TIER_4: 10 }[source.authorityTier];
  const firstParty = source.isFirstParty ? 20 : 0;
  const registryReliability = Math.round((source.reliabilityScore - 50) * 0.2);
  return [
    component("authority_tier", "Registry authority tier", tierBase, `${source.authorityTier.replace("_", " ")} uses a fixed authority baseline.`),
    component("first_party", "First-party source", firstParty, source.isFirstParty ? "The source represents the organization making the announcement." : "No first-party bonus applies."),
    component("reliability", "Registry reliability", registryReliability, "The approved source-registry reliability value supplies a bounded adjustment."),
  ];
}

function recencyComponent(item: ConnectorItem, signals: DiscoverySignals) {
  if (!item.publishedAt || !signals.referenceTime) {
    return component("recency", "Recency", 0, "No stable publication/reference-time pair is available; recency is not inferred.");
  }
  const ageHours = Math.max(0, (signals.referenceTime.valueOf() - item.publishedAt.valueOf()) / 3_600_000);
  const value = ageHours <= 48 ? 15 : ageHours <= 168 ? 10 : ageHours <= 720 ? 5 : 0;
  return component("recency", "Recency", value, `The evidence was ${Math.round(ageHours)} hours old at the fixed scoring reference time.`);
}

function confidenceComponents(
  sourceAuthorityScore: number,
  item: ConnectorItem,
  verificationRecommendation: ScoredCandidate["verificationRecommendation"],
  signals: DiscoverySignals,
) {
  const independentSources = Math.max(0, Math.min(3, signals.independentSourceCount ?? 1));
  const contradictions = Math.max(0, Math.min(3, signals.contradictoryClaims ?? 0));
  return [
    component("source_authority", "Source authority", Math.round(sourceAuthorityScore * 0.5), "Half of the deterministic source-authority score carries into confidence."),
    component("direct_evidence", "Direct evidence", item.directEvidence ? 25 : 0, item.directEvidence ? "The item is direct evidence from its registered source." : "The item is indirect reporting."),
    component("corroboration", "Independent corroboration", independentSources <= 1 ? 0 : independentSources === 2 ? 10 : 16, `${independentSources} independent registered source signal(s) support this event.`),
    component("evidence_completeness", "Evidence completeness", (signals.evidenceComplete ?? Boolean(item.summary?.trim())) ? 7 : 0, item.summary?.trim() ? "Usable source-supported facts are present." : "Evidence is incomplete."),
    component("verification_state", "Verification state", verificationRecommendation === "CONFIRMED" ? 2 : 0, `The deterministic recommendation is ${verificationRecommendation.replaceAll("_", " ")}.`),
    component("contradictions", "Contradictions", contradictions * -12, contradictions ? `${contradictions} unresolved contradiction(s) reduce confidence.` : "No contradiction penalty applies."),
  ];
}

function newsworthinessComponents(source: DiscoverySource, item: ConnectorItem, signals: DiscoverySignals) {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  const significance = /\b(?:release date|delay|launch date)\b/i.test(haystack) ? 25
    : /\b(?:trailer|gameplay|preorder|pre-order|price|platform)\b/i.test(haystack) ? 20
      : /\b(?:character|map|vice city|leonida)\b/i.test(haystack) ? 15 : 5;
  const magnitude = /\b(?:delay|release date|preorder|pre-order|trailer|gameplay)\b/i.test(haystack) ? 11 : 5;
  return [
    component("official_announcement", "Official announcement", source.isFirstParty && item.directEvidence ? 25 : 0, source.isFirstParty && item.directEvidence ? "This is direct first-party evidence." : "No official-announcement bonus applies."),
    component("franchise_relevance", "Core GTA VI relevance", /\b(?:gta\s*(?:vi|6)|grand theft auto\s*(?:vi|6))\b/i.test(haystack) ? 12 : 0, "The rule checks explicit GTA VI naming only."),
    component("event_significance", "Event significance", significance, "A fixed topic table scores release, trailer, gameplay, character, map, platform, and preorder implications."),
    component("novelty", "Novelty", signals.isNovel === false ? 0 : 12, signals.isNovel === false ? "The event is already known." : "The supplied evidence identifies a novel or materially updated event."),
    recencyComponent(item, signals),
    component("magnitude", "Franchise impact", magnitude, "A fixed rule estimates the breadth of the confirmed change, not audience size."),
  ];
}

function seoComponents(item: ConnectorItem, signals: DiscoverySignals, primaryTopic: string) {
  const evergreen = detectEvergreenOpportunity(item.title, item.summary);
  const links = suggestedInternalLinks(item.title, item.summary);
  return [
    component("evergreen_relationship", "Evergreen relationship", evergreen.recommended ? 24 : 6, evergreen.reason ?? "The item has no strong evergreen-page relationship."),
    component("search_intent", "Search-intent clarity", primaryTopic === "GTA VI news" ? 10 : 18, `The deterministic topic is ${primaryTopic}.`),
    component("freshness", "Freshness", recencyComponent(item, signals).value, recencyComponent(item, signals).reason),
    component("topic_importance", "Core topic importance", primaryTopic === "rumors" ? 5 : 18, "Core official GTA VI topics receive a fixed opportunity value; this is not search volume."),
    component("content_gap", "Existing content gap", signals.isNovel === false ? 0 : 15, signals.isNovel === false ? "Existing coverage already represents the event." : "The normalized input identifies a content opportunity."),
    component("internal_links", "Internal-link opportunity", Math.min(10, links.length * 3), `${links.length} relevant internal-link target(s) were found.`),
  ];
}

function trendComponents(signals: DiscoverySignals) {
  const hasInputs = [signals.publicationMentions, signals.communityMentions, signals.repeatedQuestions, signals.searchTrendIndex]
    .some((value) => value !== undefined);
  if (!hasInputs) return [component("no_trend_inputs", "No trend inputs", 0, "No real trend measurements were supplied, so trend remains zero.")];
  return [
    component("publication_velocity", "Publication velocity", Math.min(40, Math.max(0, signals.publicationMentions ?? 0) * 8), "Uses supplied publication-mention counts only."),
    component("community_velocity", "Community velocity", Math.min(25, Math.max(0, signals.communityMentions ?? 0) * 3), "Uses supplied community-mention counts only."),
    component("repeated_questions", "Repeated questions", Math.min(20, Math.max(0, signals.repeatedQuestions ?? 0) * 4), "Uses supplied repeated-question counts only."),
    component("search_trend", "Search trend", Math.min(15, Math.max(0, Math.round((signals.searchTrendIndex ?? 0) * 0.15))), "Uses a supplied real trend index only; no search volume is fabricated."),
  ];
}

function quickHitComponents(item: ConnectorItem, newsworthinessScore: number) {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  return [
    component("immediate_hook", "Immediate hook", /\b(?:new|first|confirms?|announces?|reveals?|delays?)\b/i.test(haystack) ? 22 : 8, "A fixed language rule checks for a clear immediate development."),
    component("visual_reveal", "Visual reveal", /\b(?:trailer|gameplay|video|screenshot|map|character)\b/i.test(haystack) ? 24 : 5, "Visual topics receive a fixed value."),
    component("surprise", "Surprise", /\b(?:delay|first|new|changed|unexpected)\b/i.test(haystack) ? 16 : 5, "A fixed rule checks for a surprising change."),
    component("simple_takeaway", "Simple takeaway", item.summary && item.summary.length <= 300 ? 18 : 8, "A concise supported summary is easier to explain in a short format."),
    component("breaking_relevance", "Breaking relevance", Math.round(newsworthinessScore * 0.2), "Twenty percent of deterministic newsworthiness carries into short-form potential."),
  ];
}

function primaryVideoComponents(item: ConnectorItem, foundTopics: string[]) {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  const factCount = item.summary ? Math.min(3, item.summary.split(/[.!?]+/).filter((value) => value.trim()).length) : 0;
  return [
    component("information_depth", "Information depth", Math.min(25, 8 + factCount * 6), `${factCount} supported summary fact segment(s) are available.`),
    component("context_required", "Context required", foundTopics.length > 1 ? 20 : 10, `${foundTopics.length} deterministic topic category/categories were detected.`),
    component("verified_facts", "Multiple verified facts", factCount >= 2 ? 20 : factCount === 1 ? 10 : 0, "The rule uses supported source-summary segments only."),
    component("explainer_value", "Explainer value", /\b(?:release date|delay|gameplay|preorder|platform|map|character)\b/i.test(haystack) ? 20 : 8, "High-context franchise topics receive a fixed explainer value."),
    component("follow_up", "Follow-up implications", /\b(?:release|delay|preorder|platform|online)\b/i.test(haystack) ? 15 : 6, "A fixed rule checks for downstream implications."),
  ];
}

export function scoreCandidate(
  source: DiscoverySource,
  item: ConnectorItem,
  signals: DiscoverySignals = {},
): ScoredCandidate {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  const foundTopics = topics(item.title, item.summary);
  const primaryTopic = foundTopics[0];
  const verificationRecommendation = recommendVerification(source, {
    directEvidence: item.directEvidence,
    title: item.title,
    summary: item.summary,
  });
  const authorityBreakdown = sourceAuthorityComponents(source);
  const sourceAuthorityScore = total(authorityBreakdown);
  const confidenceBreakdown = confidenceComponents(sourceAuthorityScore, item, verificationRecommendation, signals);
  const newsworthinessBreakdown = newsworthinessComponents(source, item, signals);
  const newsworthinessScore = total(newsworthinessBreakdown);
  const evergreen = detectEvergreenOpportunity(item.title, item.summary);
  const seoBreakdown = seoComponents(item, signals, primaryTopic);
  const seoOpportunityScore = total(seoBreakdown);
  const trendBreakdown = trendComponents(signals);
  const trendScore = total(trendBreakdown);
  const visualPotential = /\b(?:trailer|screenshot|map|character|vehicle|detail)\b/i.test(haystack) ? 20 : 5;
  const contentOpportunityScore = clampScore(
    newsworthinessScore * 0.45 + seoOpportunityScore * 0.3 + visualPotential + (evergreen.recommended ? 10 : 0),
  );
  const quickHitBreakdown = quickHitComponents(item, newsworthinessScore);
  const quickHitScore = total(quickHitBreakdown);
  const primaryVideoBreakdown = primaryVideoComponents(item, foundTopics);
  const primaryVideoScore = total(primaryVideoBreakdown);
  const scoreBreakdowns: ScoreBreakdowns = {
    SOURCE_AUTHORITY: authorityBreakdown,
    CONFIDENCE: confidenceBreakdown,
    NEWSWORTHINESS: newsworthinessBreakdown,
    SEO_OPPORTUNITY: seoBreakdown,
    TREND: trendBreakdown,
    QUICK_HIT: quickHitBreakdown,
    PRIMARY_VIDEO: primaryVideoBreakdown,
  };
  const inputHash = stableScoringInputHash({
    version: DISCOVERY_SCORING_VERSION,
    source: {
      id: source.id,
      authorityTier: source.authorityTier,
      isFirstParty: source.isFirstParty,
      reliabilityScore: source.reliabilityScore,
    },
    item: {
      canonicalUrl: item.canonicalUrl ?? item.url,
      title: normalizeHeadline(item.title),
      summary: item.summary?.trim() ?? null,
      publishedAt: item.publishedAt ?? null,
      contentHash: item.contentHash,
      changeType: item.changeType,
      directEvidence: item.directEvidence,
    },
    signals: {
      ...signals,
      existingEvergreenPaths: [...(signals.existingEvergreenPaths ?? [])].sort(),
    },
  });
  const uncertainties = item.summary?.trim()
    ? ["Independent corroboration and exact source wording still require editorial review."]
    : ["INSUFFICIENT EVIDENCE: the source did not provide a usable summary."];

  return {
    item,
    normalizedTitle: normalizeHeadline(item.title),
    scoringVersion: DISCOVERY_SCORING_VERSION,
    inputHash,
    sourceAuthorityScore,
    scoreBreakdowns,
    verificationRecommendation,
    confidenceScore: total(confidenceBreakdown),
    newsworthinessScore,
    seoOpportunityScore,
    trendScore,
    contentOpportunityScore,
    quickHitScore,
    primaryVideoScore,
    priority: newsworthinessScore >= 90 ? "URGENT" : newsworthinessScore >= 75 ? "HIGH" : newsworthinessScore >= 55 ? "STANDARD" : newsworthinessScore >= 35 ? "LOW" : "IGNORE",
    primaryTopic,
    secondaryTopics: foundTopics.slice(1),
    searchIntent: `Readers looking for the latest verified ${primaryTopic} information about GTA VI.`,
    suggestedKeywords: keywordSuggestions(primaryTopic, item.title),
    evergreen,
    internalLinks: suggestedInternalLinks(item.title, item.summary),
    angles: [
      "What changed and what the original source actually says",
      "Confirmed information versus open questions",
      ...(evergreen.recommended ? [`What this means for ${evergreen.path}`] : []),
      ...(trendScore >= 50 ? ["Community reaction without treating virality as proof"] : []),
    ].slice(0, 5),
    suggestedHook: `${source.name} has a new GTA VI development worth verifying.`,
    quickHitAngle: `What changed, what is confirmed, and what remains uncertain in 13 seconds.`,
    primaryVideoAngle: `A sourced 61–90 second explainer of the development, evidence, and implications.`,
    mediaRightsStatus: classifyMediaRights({
      isFirstParty: source.isFirstParty,
      authorityTier: source.authorityTier,
      sourceUrl: item.url,
    }),
    knownFacts: item.summary?.trim()
      ? [{ fact: item.summary.trim().slice(0, 500), sourceUrl: item.canonicalUrl ?? item.url }]
      : [],
    uncertainties,
  };
}
