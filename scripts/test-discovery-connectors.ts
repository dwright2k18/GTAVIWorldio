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
    connectorConfig: {
      linkPrefixes: ["/newswire/article/"],
      includeTerms: ["grand theft auto vi", "gta vi", "gta 6"],
      maxItems: 20,
      maxDetailItems: 4,
      clientRenderedListing: true,
      requireItems: true,
      detailUrls: ["https://www.rockstargames.com/newswire/article/9k2kaa1o3297k9/grand-theft-auto-vi-an-extended-look"],
    },
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
    connectorConfig: { includeTerms: ["grand theft auto vi", "gta vi", "gta 6"], discoverOfficialArticleLinks: true, maxDetailItems: 3 },
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
    connectorConfig: { linkPrefixes: ["/ir/news/", "/ir/press-releases/news-release-details/"], includeTerms: ["grand theft auto vi", "gta vi", "gta 6"], maxItems: 25, maxDetailItems: 5, followDetails: true, requireItems: true },
    rateLimitPerHour: 4,
    minCheckIntervalMinutes: 60,
    termsPolicyNotes: "Public investor-relations metadata only.",
  },
  {
    id: "41000000-0000-4000-8000-000000000009",
    name: "Rockstar Games official YouTube feed",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6VcWc1rAoWdBCM0JxrRQ3A",
    domain: "youtube.com",
    sourceType: "FIRST_PARTY",
    authorityTier: "TIER_1",
    isFirstParty: true,
    reliabilityScore: 100,
    connectorKind: "ATOM",
    connectorConfig: { includeTerms: ["grand theft auto vi", "gta vi", "gta 6"], maxItems: 20, requireItems: true },
    rateLimitPerHour: 2,
    minCheckIntervalMinutes: 120,
    termsPolicyNotes: "Public official feed metadata only; no media downloads.",
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
