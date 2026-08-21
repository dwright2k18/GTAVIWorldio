import type { DiscoverySource } from "../src/lib/discovery/types";
import { previewDiscoverySource } from "../src/lib/discovery/pipeline";

const sources: DiscoverySource[] = [
  {
    id: "41000000-0000-4000-8000-000000000001",
    name: "Rockstar Games Newswire — GTA VI",
    url: "https://www.rockstargames.com/newswire?tag_id=722",
    domain: "rockstargames.com",
    sourceType: "FIRST_PARTY",
    authorityTier: "TIER_1",
    isFirstParty: true,
    reliabilityScore: 100,
    connectorKind: "HTML_LISTING",
    connectorConfig: { linkPrefixes: ["/newswire/article/"], maxItems: 5 },
    rateLimitPerHour: 4,
    minCheckIntervalMinutes: 30,
    termsPolicyNotes: "Public listing metadata only; no media downloads.",
  },
  {
    id: "41000000-0000-4000-8000-000000000002",
    name: "Official Grand Theft Auto VI page",
    url: "https://www.rockstargames.com/VI",
    domain: "rockstargames.com",
    sourceType: "FIRST_PARTY",
    authorityTier: "TIER_1",
    isFirstParty: true,
    reliabilityScore: 100,
    connectorKind: "HTML_CHANGE",
    connectorConfig: {},
    rateLimitPerHour: 2,
    minCheckIntervalMinutes: 60,
    termsPolicyNotes: "Normalized public text hash only; no media downloads.",
  },
  {
    id: "41000000-0000-4000-8000-000000000004",
    name: "Take-Two Interactive press releases",
    url: "https://www.take2games.com/ir/press-releases",
    domain: "take2games.com",
    sourceType: "PRESS_RELEASE",
    authorityTier: "TIER_1",
    isFirstParty: true,
    reliabilityScore: 100,
    connectorKind: "HTML_LISTING",
    connectorConfig: { linkPrefixes: ["/ir/news/", "/ir/press-releases/news-release-details/"], includeTerms: ["grand theft auto vi", "gta vi", "gta 6"], maxItems: 5 },
    rateLimitPerHour: 4,
    minCheckIntervalMinutes: 60,
    termsPolicyNotes: "Public investor-relations metadata only.",
  },
  {
    id: "41000000-0000-4000-8000-000000000005",
    name: "VGC — Video Games Chronicle",
    url: "https://www.videogameschronicle.com/",
    domain: "videogameschronicle.com",
    sourceType: "JOURNALISM",
    authorityTier: "TIER_2",
    isFirstParty: false,
    reliabilityScore: 84,
    connectorKind: "HTML_LISTING",
    connectorConfig: { linkPrefixes: ["/news/"], includeTerms: ["grand theft auto vi", "gta vi", "gta 6"], maxItems: 5 },
    rateLimitPerHour: 2,
    minCheckIntervalMinutes: 180,
    termsPolicyNotes: "Metadata and short extracted facts only.",
  },
];

async function main() {
  const reports = [];
  for (const source of sources) {
    try {
      const result = await previewDiscoverySource(source);
      reports.push({
        source: source.name,
        status: "PASS",
        httpStatus: result.httpStatus,
        requestCount: result.requestCount,
        responseBytes: result.responseBytes,
        candidates: result.candidates.map(({ scored, research }) => ({
          isTest: true,
          title: scored.item.title,
          canonicalUrl: scored.item.canonicalUrl ?? scored.item.url,
          verification: scored.verificationRecommendation,
          confidence: scored.confidenceScore,
          newsworthiness: scored.newsworthinessScore,
          seo: scored.seoOpportunityScore,
          evergreen: scored.evergreen.path,
          aiStatus: research.aiStatus,
        })),
      });
    } catch (error) {
      reports.push({
        source: source.name,
        status: "FAIL",
        error: error instanceof Error ? error.message : "Unknown connector failure",
      });
    }
  }
  console.log(JSON.stringify({
    mode: "TEST_ONLY",
    persistedRecords: 0,
    recurringMonitoring: false,
    automaticPublishing: false,
    reports,
  }, null, 2));
  if (reports.some((report) => report.status === "FAIL")) process.exitCode = 1;
}

void main();
