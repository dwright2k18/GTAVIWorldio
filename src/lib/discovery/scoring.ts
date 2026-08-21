import { detectEvergreenOpportunity, suggestedInternalLinks } from "./evergreen";
import { normalizeHeadline } from "./normalize";
import { classifyMediaRights } from "./safety";
import { clampScore, confidenceScore, recommendVerification } from "./verification";
import type { ConnectorItem, DiscoverySignals, DiscoverySource, ScoredCandidate } from "./types";

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

export function scoreCandidate(
  source: DiscoverySource,
  item: ConnectorItem,
  signals: DiscoverySignals = {},
): ScoredCandidate {
  const haystack = `${item.title} ${item.summary ?? ""}`;
  const foundTopics = topics(item.title, item.summary);
  const primaryTopic = foundTopics[0];
  const officialImpact = source.isFirstParty && item.directEvidence ? 24 : 0;
  const majorImpact = /\b(?:release date|delay|trailer|preorder|price|platform)\b/i.test(haystack) ? 24 : 0;
  const recencyHours = item.publishedAt ? Math.max(0, (Date.now() - item.publishedAt.valueOf()) / 3_600_000) : 24;
  const recency = Math.max(0, 14 - Math.floor(recencyHours / 12));
  const newsworthinessScore = clampScore(
    source.reliabilityScore * 0.28 + officialImpact + majorImpact + recency + (signals.isNovel === false ? -20 : 8),
  );
  const evergreen = detectEvergreenOpportunity(item.title, item.summary);
  const seoOpportunityScore = clampScore(
    22 + majorImpact + (evergreen.recommended ? 20 : 0) + recency + (primaryTopic === "rumors" ? -12 : 0),
  );
  const trendScore = clampScore(
    (signals.publicationMentions ?? 0) * 12 +
      (signals.communityMentions ?? 0) * 4 +
      (signals.repeatedQuestions ?? 0) * 5,
  );
  const visualPotential = /\b(?:trailer|screenshot|map|character|vehicle|detail)\b/i.test(haystack) ? 20 : 5;
  const contentOpportunityScore = clampScore(
    newsworthinessScore * 0.45 + seoOpportunityScore * 0.3 + visualPotential + (evergreen.recommended ? 10 : 0),
  );
  const quickHitScore = clampScore(
    newsworthinessScore * 0.42 + trendScore * 0.25 + visualPotential + (/\b(?:changed|new|first|confirmed|false)\b/i.test(haystack) ? 12 : 0),
  );
  const primaryVideoScore = clampScore(
    newsworthinessScore * 0.38 + seoOpportunityScore * 0.32 + (foundTopics.length > 1 ? 18 : 7),
  );
  const confidence = confidenceScore(source, {
    directEvidence: item.directEvidence,
    independentSourceCount: signals.independentSourceCount ?? 1,
    ageHours: recencyHours,
  });
  const verificationRecommendation = recommendVerification(source, {
    directEvidence: item.directEvidence,
    title: item.title,
    summary: item.summary,
  });
  const uncertainties = item.summary?.trim()
    ? ["Independent corroboration and exact source wording still require editorial review."]
    : ["INSUFFICIENT EVIDENCE: the source did not provide a usable summary."];

  return {
    item,
    normalizedTitle: normalizeHeadline(item.title),
    verificationRecommendation,
    confidenceScore: confidence,
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
