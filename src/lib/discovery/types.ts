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

export type ConnectorResult = {
  sourceUrl: string;
  fetchedAt: Date;
  httpStatus: number;
  responseBytes: number;
  responseHash: string;
  requestCount: number;
  items: ConnectorItem[];
  warnings: string[];
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
>;

export type DiscoverySignals = {
  independentSourceCount?: number;
  publicationMentions?: number;
  communityMentions?: number;
  repeatedQuestions?: number;
  isNovel?: boolean;
  existingEvergreenPaths?: string[];
};

export type ScoredCandidate = {
  item: ConnectorItem;
  normalizedTitle: string;
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
