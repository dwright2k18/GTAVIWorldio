import type { QuickHit, Story, VerificationStatus } from "@/lib/types";
import { normalizeSearchTerm } from "@/lib/format";

const officialSource = {
  name: "Rockstar Games — Grand Theft Auto VI",
  url: "https://www.rockstargames.com/VI",
  note: "Primary official materials. Editorial interpretation is labeled separately.",
};

export const stories: Story[] = [
  {
    storyId: "story-001",
    headline: "Everything Officially Confirmed About GTA VI So Far",
    slug: "everything-officially-confirmed-so-far",
    summary:
      "A demonstration of the GTA VI World fact file: official details stay separate from reports, rumors, and community theories.",
    article: [
      {
        type: "paragraph",
        content:
          "This sample article demonstrates how GTA VI World will organize verified coverage. Every statement marked Confirmed must trace back to material published directly by Rockstar Games or Take-Two Interactive.",
      },
      { type: "heading", content: "The verification rule" },
      {
        type: "paragraph",
        content:
          "Official trailers, screenshots, newsroom posts, store listings, and direct corporate communications qualify as primary sources. Commentary and visual interpretation remain analysis, even when the underlying media is official.",
      },
      {
        type: "list",
        items: [
          "Confirmed facts link to a primary source.",
          "Reports identify the publication and its evidence.",
          "Rumors and alleged leaks never inherit a confirmed label.",
          "Updates preserve the original publication and revision dates.",
        ],
      },
      { type: "heading", content: "Built to stay current" },
      {
        type: "paragraph",
        content:
          "The final knowledge page will grow as new official information arrives. The central Story ID lets the newsroom connect each update to articles, short videos, social posts, and future corrections without duplicating the underlying record.",
      },
    ],
    category: "Official",
    verification: "CONFIRMED",
    source: officialSource,
    dateDiscovered: "2026-08-20T13:00:00.000Z",
    datePublished: "2026-08-20T14:00:00.000Z",
    dateUpdated: "2026-08-20T14:00:00.000Z",
    author: "GTA VI World Editorial Desk",
    readingMinutes: 4,
    heroMedia: {
      alt: "Original neon editorial artwork representing the GTA VI World confirmed fact file",
      label: "THE FACT FILE",
      gradient:
        "linear-gradient(135deg, #160c28 0%, #5f185f 42%, #f04b87 72%, #f6a04d 100%)",
      accent: "#ff8dc7",
    },
    tags: ["official", "confirmed", "release date", "platforms", "guide"],
    relatedStoryIds: ["story-002", "story-003", "story-005"],
    relatedVideoIds: ["quick-001", "quick-003"],
    social: {},
    metrics: { views: 18740, engagement: 0.071, trendingScore: 98 },
    isSample: true,
  },
  {
    storyId: "story-002",
    headline: "GTA VI Trailer Analysis: Reading the Details Rockstar Chose to Show",
    slug: "gta-vi-trailer-analysis",
    summary:
      "A scene-by-scene editorial framework that distinguishes visible evidence from interpretation.",
    article: [
      {
        type: "paragraph",
        content:
          "Trailer analysis is strongest when the evidence is visible and the conclusion is modest. This sample story shows how GTA VI World will cite the official material first, then label interpretation as analysis rather than fact.",
      },
      { type: "heading", content: "Observation before conclusion" },
      {
        type: "paragraph",
        content:
          "A location, vehicle, or character shown on screen can be described. Its role in the final game may still be unknown. Our editorial template keeps those two statements apart so readers can see exactly where evidence ends and inference begins.",
      },
      {
        type: "quote",
        content:
          "A confident headline should never outrun the source material beneath it.",
      },
    ],
    category: "Analysis",
    verification: "CONFIRMED",
    source: officialSource,
    dateDiscovered: "2026-08-20T12:00:00.000Z",
    datePublished: "2026-08-20T13:00:00.000Z",
    dateUpdated: "2026-08-20T13:30:00.000Z",
    author: "Maya Torres",
    readingMinutes: 6,
    heroMedia: {
      alt: "Original sunset-colored artwork for a trailer analysis story",
      label: "TRAILER DESK",
      gradient:
        "linear-gradient(145deg, #071d3a 0%, #155e75 40%, #db2777 72%, #fb923c 100%)",
      accent: "#67e8f9",
    },
    tags: ["trailer", "analysis", "official footage", "details"],
    relatedStoryIds: ["story-001", "story-004", "story-005"],
    relatedVideoIds: ["quick-002", "quick-004"],
    social: {},
    metrics: { views: 15430, engagement: 0.083, trendingScore: 94 },
    isSample: true,
  },
  {
    storyId: "story-003",
    headline: "Meet Lucia: Building a Character Guide From Official Material",
    slug: "meet-lucia",
    summary:
      "How the character hub will organize confirmed information without turning fan interpretation into biography.",
    article: [
      {
        type: "paragraph",
        content:
          "This development sample establishes the structure for a future Lucia knowledge page. Confirmed appearances and official descriptions belong in the fact layer; themes, motivations, and predictions belong in clearly labeled analysis.",
      },
      { type: "heading", content: "A durable character record" },
      {
        type: "list",
        items: [
          "Primary-source appearances",
          "Confirmed relationships and locations",
          "Editorial analysis with visible labeling",
          "Related stories, videos, and timeline updates",
        ],
      },
    ],
    category: "Characters",
    verification: "CONFIRMED",
    source: officialSource,
    dateDiscovered: "2026-08-19T17:00:00.000Z",
    datePublished: "2026-08-20T11:00:00.000Z",
    dateUpdated: "2026-08-20T11:00:00.000Z",
    author: "GTA VI World Editorial Desk",
    readingMinutes: 5,
    heroMedia: {
      alt: "Original magenta and gold character profile artwork",
      label: "CHARACTER FILE 01",
      gradient:
        "linear-gradient(125deg, #2a0d2e 0%, #9d174d 48%, #f97316 100%)",
      accent: "#f9a8d4",
    },
    tags: ["Lucia", "characters", "guide", "official"],
    relatedStoryIds: ["story-004", "story-001", "story-002"],
    relatedVideoIds: ["quick-003"],
    social: {},
    metrics: { views: 12380, engagement: 0.092, trendingScore: 91 },
    isSample: true,
  },
  {
    storyId: "story-004",
    headline: "Meet Jason: Separating Character Evidence From Fan Theory",
    slug: "meet-jason",
    summary:
      "A sample character file designed to expand as verified details become available.",
    article: [
      {
        type: "paragraph",
        content:
          "Character coverage can quickly fill gaps with assumptions. GTA VI World will use a living profile that records what is official, what is observed in official media, and what remains interpretation.",
      },
      { type: "heading", content: "The evidence ladder" },
      {
        type: "paragraph",
        content:
          "Direct publication sits at the top, visible trailer evidence follows, and editorial interpretation comes last. Community theories can be useful, but they never change the verification status of the source material.",
      },
    ],
    category: "Characters",
    verification: "CONFIRMED",
    source: officialSource,
    dateDiscovered: "2026-08-19T16:00:00.000Z",
    datePublished: "2026-08-20T10:00:00.000Z",
    dateUpdated: "2026-08-20T10:00:00.000Z",
    author: "GTA VI World Editorial Desk",
    readingMinutes: 4,
    heroMedia: {
      alt: "Original blue and coral character profile artwork",
      label: "CHARACTER FILE 02",
      gradient:
        "linear-gradient(140deg, #071936 0%, #1d4ed8 45%, #f43f5e 100%)",
      accent: "#93c5fd",
    },
    tags: ["Jason", "characters", "guide", "official"],
    relatedStoryIds: ["story-003", "story-002", "story-001"],
    relatedVideoIds: ["quick-004"],
    social: {},
    metrics: { views: 11020, engagement: 0.078, trendingScore: 87 },
    isSample: true,
  },
  {
    storyId: "story-005",
    headline: "Exploring Vice City: An Evidence-First World Guide",
    slug: "exploring-vice-city",
    summary:
      "A visual index for locations shown through official channels, with room for future updates and corrections.",
    article: [
      {
        type: "paragraph",
        content:
          "The future world guide will connect named places, visible landmarks, screenshots, trailer moments, and map entries. Every location will carry its own confidence level so a community reconstruction cannot be mistaken for an official map.",
      },
      { type: "heading", content: "Location confidence" },
      {
        type: "list",
        items: [
          "Confirmed: explicitly named or shown in official material.",
          "Likely: supported by multiple visible clues but not directly named.",
          "Speculative: a community interpretation awaiting stronger evidence.",
        ],
      },
    ],
    category: "World",
    verification: "CONFIRMED",
    source: officialSource,
    dateDiscovered: "2026-08-19T15:00:00.000Z",
    datePublished: "2026-08-20T09:00:00.000Z",
    dateUpdated: "2026-08-20T09:20:00.000Z",
    author: "Nico Reyes",
    readingMinutes: 7,
    heroMedia: {
      alt: "Original cyan, violet, and sunset city-grid artwork",
      label: "WORLD INDEX",
      gradient:
        "linear-gradient(155deg, #082f49 0%, #0e7490 35%, #7e22ce 68%, #fb7185 100%)",
      accent: "#a5f3fc",
    },
    tags: ["Vice City", "map", "locations", "world", "guide"],
    relatedStoryIds: ["story-006", "story-002", "story-001"],
    relatedVideoIds: ["quick-001", "quick-005"],
    social: {},
    metrics: { views: 14220, engagement: 0.081, trendingScore: 93 },
    isSample: true,
  },
  {
    storyId: "story-006",
    headline: "GTA VI Map Analysis: What Is Visible and What Is Still Theory",
    slug: "gta-vi-map-analysis",
    summary:
      "A transparent look at how community map analysis can be useful without being presented as official geography.",
    article: [
      {
        type: "paragraph",
        content:
          "Community mapping combines visual clues, repeated landmarks, road layouts, and educated guesses. This sample is intentionally labeled Speculation because the assembled result is not an official game map.",
      },
      { type: "heading", content: "Useful does not mean confirmed" },
      {
        type: "paragraph",
        content:
          "A transparent map interface can display the source behind every marker and assign Confirmed, Likely, or Speculative confidence. Readers should never have to hunt for the difference.",
      },
    ],
    category: "Analysis",
    verification: "SPECULATION",
    source: officialSource,
    dateDiscovered: "2026-08-19T14:00:00.000Z",
    datePublished: "2026-08-19T20:00:00.000Z",
    dateUpdated: "2026-08-20T08:00:00.000Z",
    author: "Nico Reyes",
    readingMinutes: 8,
    heroMedia: {
      alt: "Original speculative map-grid artwork labeled as analysis",
      label: "MAP LAB",
      gradient:
        "linear-gradient(135deg, #111827 0%, #164e63 42%, #a21caf 100%)",
      accent: "#c4b5fd",
    },
    tags: ["map", "analysis", "speculation", "locations"],
    relatedStoryIds: ["story-005", "story-002", "story-007"],
    relatedVideoIds: ["quick-005"],
    social: {},
    metrics: { views: 16980, engagement: 0.097, trendingScore: 96 },
    isSample: true,
  },
  {
    storyId: "story-007",
    headline: "GTA VI vs. GTA V: A Careful Framework for Future Comparisons",
    slug: "gta-vi-vs-gta-v",
    summary:
      "A sample comparison desk that avoids declaring unseen gameplay systems as fact.",
    article: [
      {
        type: "paragraph",
        content:
          "Comparisons can help explain scale, technology, tone, and design. They can also overstate what a trailer proves. This sample framework reserves direct comparisons for observable or officially published information.",
      },
      { type: "heading", content: "Comparison categories" },
      {
        type: "list",
        items: [
          "Officially described features",
          "Visible presentation and setting",
          "Platform and release information",
          "Clearly labeled expectations that remain speculative",
        ],
      },
    ],
    category: "Gameplay",
    verification: "SPECULATION",
    source: officialSource,
    dateDiscovered: "2026-08-18T15:00:00.000Z",
    datePublished: "2026-08-19T18:00:00.000Z",
    dateUpdated: "2026-08-19T18:00:00.000Z",
    author: "Maya Torres",
    readingMinutes: 6,
    heroMedia: {
      alt: "Original split-tone comparison artwork in blue and pink",
      label: "COMPARISON DESK",
      gradient:
        "linear-gradient(110deg, #0f172a 0%, #1d4ed8 49%, #be185d 51%, #fb7185 100%)",
      accent: "#fbcfe8",
    },
    tags: ["gameplay", "comparison", "GTA V", "speculation"],
    relatedStoryIds: ["story-002", "story-006", "story-001"],
    relatedVideoIds: ["quick-002"],
    social: {},
    metrics: { views: 9280, engagement: 0.064, trendingScore: 80 },
    isSample: true,
  },
  {
    storyId: "story-008",
    headline: "Development Sample: A GTA VI Feature Claim With No Primary Source",
    slug: "development-sample-unverified-feature-claim",
    summary:
      "A deliberately non-factual example showing how an unsupported claim is labeled, sourced, and kept away from confirmed coverage.",
    article: [
      {
        type: "paragraph",
        content:
          "This is a newsroom training example, not a claim about GTA VI. It exists so the Rumor filter and article template can be evaluated without inventing a real announcement or repeating an unverified allegation.",
      },
      { type: "heading", content: "Why the label matters" },
      {
        type: "paragraph",
        content:
          "A claim with no primary source, no attributable reporting, and no independently verifiable evidence cannot be presented as fact. The Rumor badge remains visible in the headline area, story card, search result, and related content.",
      },
      {
        type: "list",
        items: [
          "No official confirmation is implied.",
          "The lack of evidence is stated near the top.",
          "The story can be updated or corrected without losing its history.",
        ],
      },
    ],
    category: "Community",
    verification: "RUMOR",
    source: {
      name: "GTA VI World editorial training example",
      url: "/stories/everything-officially-confirmed-so-far",
      note: "No external claim is being reported. This page is sample content for interface testing.",
    },
    dateDiscovered: "2026-08-20T08:00:00.000Z",
    datePublished: "2026-08-20T08:30:00.000Z",
    dateUpdated: "2026-08-20T08:30:00.000Z",
    author: "GTA VI World Standards Desk",
    readingMinutes: 3,
    heroMedia: {
      alt: "Original amber warning artwork for a development-only rumor example",
      label: "RUMOR LAB",
      gradient: "linear-gradient(140deg, #1c1917 0%, #78350f 48%, #d97706 100%)",
      accent: "#fde68a",
    },
    tags: ["rumor", "verification", "sample", "editorial standards"],
    relatedStoryIds: ["story-001", "story-006", "story-002"],
    relatedVideoIds: [],
    social: {},
    metrics: { views: 3100, engagement: 0.045, trendingScore: 52 },
    isSample: true,
  },
];

export const quickHits: QuickHit[] = [
  {
    videoId: "quick-001",
    storyId: "story-005",
    headline: "Vice City clues in 13 seconds",
    slug: "vice-city-clues",
    category: "World",
    verification: "CONFIRMED",
    publishedAt: "2026-08-20T14:20:00.000Z",
    durationSeconds: 13,
    media: {
      alt: "Original vertical neon city artwork",
      label: "VICE CITY",
      gradient: "linear-gradient(165deg, #061b2d, #0e7490 45%, #ec4899 80%, #fb923c)",
      accent: "#67e8f9",
    },
    social: {},
    metrics: { views: 48300, engagement: 0.121, viralScore: 92 },
    isSample: true,
  },
  {
    videoId: "quick-002",
    storyId: "story-002",
    headline: "One trailer detail worth pausing",
    slug: "trailer-detail-pause",
    category: "Analysis",
    verification: "CONFIRMED",
    publishedAt: "2026-08-20T13:40:00.000Z",
    durationSeconds: 13,
    media: {
      alt: "Original vertical trailer-analysis artwork",
      label: "FRAME CHECK",
      gradient: "linear-gradient(150deg, #111827, #312e81 42%, #db2777 76%, #f59e0b)",
      accent: "#fde68a",
    },
    social: {},
    metrics: { views: 39700, engagement: 0.114, viralScore: 88 },
    isSample: true,
  },
  {
    videoId: "quick-003",
    storyId: "story-003",
    headline: "Lucia: fact file in 13 seconds",
    slug: "lucia-fact-file",
    category: "Characters",
    verification: "CONFIRMED",
    publishedAt: "2026-08-20T12:35:00.000Z",
    durationSeconds: 13,
    media: {
      alt: "Original vertical magenta character-file artwork",
      label: "LUCIA FILE",
      gradient: "linear-gradient(160deg, #2e1065, #9d174d 55%, #f97316)",
      accent: "#f9a8d4",
    },
    social: {},
    metrics: { views: 35200, engagement: 0.128, viralScore: 90 },
    isSample: true,
  },
  {
    videoId: "quick-004",
    storyId: "story-004",
    headline: "Jason: evidence vs. theory",
    slug: "jason-evidence-vs-theory",
    category: "Characters",
    verification: "CONFIRMED",
    publishedAt: "2026-08-20T11:15:00.000Z",
    durationSeconds: 13,
    media: {
      alt: "Original vertical blue character-file artwork",
      label: "JASON FILE",
      gradient: "linear-gradient(155deg, #082f49, #1d4ed8 54%, #f43f5e)",
      accent: "#93c5fd",
    },
    social: {},
    metrics: { views: 31600, engagement: 0.109, viralScore: 84 },
    isSample: true,
  },
  {
    videoId: "quick-005",
    storyId: "story-006",
    headline: "Map theory: confirmed or speculative?",
    slug: "map-theory-status",
    category: "Analysis",
    verification: "SPECULATION",
    publishedAt: "2026-08-20T10:10:00.000Z",
    durationSeconds: 13,
    media: {
      alt: "Original vertical map-grid artwork marked speculation",
      label: "MAP LAB",
      gradient: "linear-gradient(145deg, #111827, #155e75 48%, #7e22ce)",
      accent: "#c4b5fd",
    },
    social: {},
    metrics: { views: 42800, engagement: 0.137, viralScore: 94 },
    isSample: true,
  },
];

export const verificationDetails: Record<
  VerificationStatus,
  { short: string; description: string }
> = {
  CONFIRMED: {
    short: "Primary source",
    description: "Published or directly supported by an official primary source.",
  },
  "CREDIBLE REPORT": {
    short: "Sourced reporting",
    description: "Reported by a reliable outlet, but not yet officially confirmed.",
  },
  RUMOR: {
    short: "Unverified claim",
    description: "Circulating information without enough evidence for confirmation.",
  },
  SPECULATION: {
    short: "Editorial analysis",
    description: "Reasoned interpretation or theory, clearly separated from fact.",
  },
  "ALLEGED LEAK": {
    short: "Unverified material",
    description: "Purported non-public material whose authenticity is not established.",
  },
};

export const heroStory = stories[0];

export function getStoryBySlug(slug: string) {
  return stories.find((story) => story.slug === slug);
}

export function getStoryById(storyId: string) {
  return stories.find((story) => story.storyId === storyId);
}

export function getRelatedStories(story: Story) {
  return story.relatedStoryIds
    .map(getStoryById)
    .filter((related): related is Story => Boolean(related));
}

export function getRelatedQuickHits(story: Story) {
  return story.relatedVideoIds
    .map((videoId) => quickHits.find((video) => video.videoId === videoId))
    .filter((video): video is QuickHit => Boolean(video));
}

export function searchContent(query: string) {
  const term = normalizeSearchTerm(query);

  if (!term) return { stories: [], quickHits: [] };

  return {
    stories: stories.filter((story) =>
      normalizeSearchTerm(
        [
          story.headline,
          story.summary,
          story.category,
          story.verification,
          ...story.tags,
        ].join(" "),
      ).includes(term),
    ),
    quickHits: quickHits.filter((video) =>
      normalizeSearchTerm(
        [video.headline, video.category, video.verification].join(" "),
      ).includes(term),
    ),
  };
}
