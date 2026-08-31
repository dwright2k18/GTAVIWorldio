import type {
  MonitoredSource,
  verificationStatusEnum,
} from "@/db/schema";

export type VerificationRecommendation =
  (typeof verificationStatusEnum.enumValues)[number];

export type ConnectorItem = {
  title: string;
  url: string;
  canonicalUrl?: string;
  author?: string;
  summary?: string;
  publishedAt?: Date;
  sourceHash: string;
  contentHash: string;
  changeType:
    | "NEW_ARTICLE"
    | "TEXT_UPDATE"
    | "RELEASE_DATE_CHANGE"
    | "PLATFORM_CHANGE"
    | "PRICE_CHANGE"
    | "PREORDER_CHANGE"
    | "TRAILER_ADDED"
    | "SCREENSHOT_ADDED"
    | "METADATA_CHANGE"
    | "UNKNOWN";
  directEvidence: boolean;
  metadata: Record<string, unknown>;
};

export type SourceHttpCacheEntry = {
  etag?: string;
  lastModified?: string;
  contentHash?: string;
  semanticHash?: string;
  listingHash?: string;
  checkedAt?: string;
};

export type ConnectorMetrics = {
  listingRequests: number;
  detailRequests: number;
  conditionalRequests: number;
  notModifiedResponses: number;
  hashUnchangedExits: number;
  detailFetchesAvoided: number;
  detailFetchesDeferred: number;
  knownUrlSkips: number;
  requestsSaved: number;
};

export type ExtractionMethod =
  | "STRUCTURED_FEED"
  | "JSON_LD"
  | "SSR_HTML"
  | "OPEN_GRAPH"
  | "KNOWN_ARTICLE_METADATA"
  | "OFFICIAL_VIDEO_FEED"
  | "NONE";

export type ConnectorResult = {
  sourceUrl: string;
  fetchedAt: Date;
  httpStatus: number;
  responseBytes: number;
  responseHash: string;
  requestCount: number;
  successfulResponses?: number;
  successfulExtractions?: number;
  items: ConnectorItem[];
  extractionMethod: ExtractionMethod;
  extractionSucceeded: boolean;
  health: "HEALTHY" | "DEGRADED" | "FAILED";
  lastContentHash?: string;
  warnings: string[];
  cacheUpdates?: Record<string, SourceHttpCacheEntry>;
  metrics?: ConnectorMetrics;
};

export type DiscoverySource = Pick<
  MonitoredSource,
  | "id"
  | "name"
  | "url"
  | "domain"
  | "sourceType"
  | "authorityTier"
  | "isFirstParty"
  | "reliabilityScore"
  | "connectorKind"
  | "connectorConfig"
  | "rateLimitPerHour"
  | "minCheckIntervalMinutes"
  | "termsPolicyNotes"
> & {
  healthStatus?: "NOT_CHECKED" | "HEALTHY" | "DEGRADED" | "FAILED" | "PAUSED" | "CIRCUIT_OPEN";
  lastContentHash?: string | null;
  lastExtractionMethod?: string | null;
  lastCheckedAt?: Date | null;
  lastSuccessfulFetchAt?: Date | null;
  httpCache?: Record<string, SourceHttpCacheEntry>;
  knownUrls?: string[];
};

export type DiscoverySignals = {
  independentSourceCount?: number;
  contradictoryClaims?: number;
  publicationMentions?: number;
  communityMentions?: number;
  repeatedQuestions?: number;
  searchTrendIndex?: number;
  isNovel?: boolean;
  evidenceComplete?: boolean;
  referenceTime?: Date;
  existingEvergreenPaths?: string[];
};

export type ScoreMetric =
  | "SOURCE_AUTHORITY"
  | "CONFIDENCE"
  | "NEWSWORTHINESS"
  | "SEO_OPPORTUNITY"
  | "TREND"
  | "QUICK_HIT"
  | "PRIMARY_VIDEO";

export type ScoreComponent = {
  key: string;
  label: string;
  value: number;
  reason: string;
};

export type ScoreBreakdowns = Record<ScoreMetric, ScoreComponent[]>;

export type ScoredCandidate = {
  item: ConnectorItem;
  normalizedTitle: string;
  scoringVersion: string;
  inputHash: string;
  sourceAuthorityScore: number;
  scoreBreakdowns: ScoreBreakdowns;
  verificationRecommendation: VerificationRecommendation;
  confidenceScore: number;
  newsworthinessScore: number;
  seoOpportunityScore: number;
  trendScore: number;
  contentOpportunityScore: number;
  quickHitScore: number;
  primaryVideoScore: number;
  priority: "URGENT" | "HIGH" | "STANDARD" | "LOW" | "IGNORE";
  primaryTopic: string;
  secondaryTopics: string[];
  searchIntent: string;
  suggestedKeywords: string[];
  evergreen: {
    recommended: boolean;
    path: string | null;
    reason: string | null;
  };
  internalLinks: Array<{ path: string; reason: string }>;
  angles: string[];
  suggestedHook: string;
  quickHitAngle: string;
  primaryVideoAngle: string;
  mediaRightsStatus:
    | "OFFICIAL_EMBEDDABLE"
    | "OWNED"
    | "LICENSED"
    | "COMMENTARY_ONLY"
    | "DO_NOT_HOST"
    | "UNKNOWN_RIGHTS";
  knownFacts: Array<{ fact: string; sourceUrl: string }>;
  uncertainties: string[];
};

export type DuplicateAssessment = {
  status: "NEW_STORY" | "RELATED" | "LIKELY_DUPLICATE" | "DUPLICATE";
  similarity: number;
  reason: string;
  matchingCandidateId?: string;
};
