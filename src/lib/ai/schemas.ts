import { z } from "zod";

export const verificationStatusSchema = z.enum([
  "CONFIRMED",
  "CREDIBLE_REPORT",
  "RUMOR",
  "SPECULATION",
  "ALLEGED_LEAK",
]);

export const mediaRightsSchema = z.enum([
  "OFFICIAL_EMBEDDABLE",
  "OWNED",
  "LICENSED",
  "COMMENTARY_ONLY",
  "DO_NOT_HOST",
  "UNKNOWN_RIGHTS",
]);

const evidenceIdSchema = z.uuid();
const sourceUrlSchema = z.url();

export const sourceReferenceSchema = z.object({
  evidenceId: evidenceIdSchema,
  title: z.string().min(1).max(300),
  sourceUrl: sourceUrlSchema,
  sourceType: z.enum([
    "FIRST_PARTY",
    "PRESS_RELEASE",
    "INVESTOR_REPORT",
    "INTERVIEW",
    "JOURNALISM",
    "PUBLIC_RECORD",
    "COMMUNITY_DISCOVERY",
    "SOCIAL_POST",
    "OTHER",
  ]),
  authorityTier: z.enum(["TIER_1", "TIER_2", "TIER_3", "TIER_4"]),
  publishedAt: z.iso.datetime().nullable(),
});

export const researchClaimSchema = z.object({
  claimId: z.string().min(1).max(100),
  claimText: z.string().min(1).max(1_000),
  evidenceRecordIds: z.array(evidenceIdSchema).min(1).max(10),
  sourceUrl: sourceUrlSchema,
  sourceType: sourceReferenceSchema.shape.sourceType,
  attributionMode: z.enum(["DIRECT_QUOTE", "PARAPHRASE"]),
  confidence: z.number().int().min(0).max(100),
  verificationStatus: verificationStatusSchema,
  contradictionStatus: z.enum(["NONE", "POSSIBLE", "CONFIRMED"]),
  editorReviewStatus: z.enum([
    "PENDING",
    "APPROVED",
    "REJECTED",
    "NEEDS_REVIEW",
  ]),
  includedInDraft: z.boolean(),
});

export const quoteRecordSchema = z.object({
  claimId: z.string().min(1).max(100),
  evidenceId: evidenceIdSchema,
  exactText: z.string().min(1).max(600),
  speakerOrOrganization: z.string().min(1).max(200),
  originalSource: z.string().min(1).max(300),
  sourceUrl: sourceUrlSchema,
  date: z.iso.datetime().nullable(),
  locator: z.string().max(200).nullable(),
  context: z.string().min(1).max(1_000),
});

export const internalLinkSuggestionSchema = z.object({
  destination: z.string().startsWith("/").max(300),
  anchorConcept: z.string().min(1).max(120),
  readerBenefit: z.string().min(1).max(300),
  pageExists: z.boolean(),
  destinationPublished: z.boolean(),
  destinationIndexable: z.boolean(),
});

const opportunityScoresSchema = z.object({
  newsworthiness: z.number().int().min(0).max(100),
  seoOpportunity: z.number().int().min(0).max(100),
  trendPotential: z.number().int().min(0).max(100),
  quickHit: z.number().int().min(0).max(100),
  primaryVideo: z.number().int().min(0).max(100),
  measuredSearchVolume: z.null(),
});

export const researchPacketSchema = z.object({
  candidateId: z.uuid(),
  eventClusterId: z.uuid().nullable(),
  proposedStoryType: z.enum(["NEWS", "FEATURE", "ANALYSIS", "GUIDE"]),
  proposedVerificationStatus: verificationStatusSchema,
  confidenceScore: z.number().int().min(0).max(100),
  officialFacts: z.array(researchClaimSchema).min(1),
  supportingFacts: z.array(researchClaimSchema),
  timeline: z.array(
    z.object({
      date: z.iso.datetime(),
      event: z.string().min(1).max(500),
      evidenceRecordIds: z.array(evidenceIdSchema).min(1),
    }),
  ),
  primarySource: sourceReferenceSchema,
  supportingSources: z.array(sourceReferenceSchema),
  conflictingClaims: z.array(
    z.object({
      summary: z.string().min(1).max(600),
      claimIds: z.array(z.string()).min(1),
    }),
  ),
  uncertainties: z.array(z.string().min(1).max(500)),
  missingInformation: z.array(z.string().min(1).max(500)),
  quoteRecords: z.array(quoteRecordSchema),
  evergreenRelationship: z.object({
    updateRecommended: z.boolean(),
    path: z.string().startsWith("/").nullable(),
    suggestedUpdate: z.string().max(1_000).nullable(),
  }),
  suggestedInternalLinks: z.array(internalLinkSuggestionSchema).max(8),
  seoSearchIntent: z.string().min(1).max(300),
  contentOpportunityScores: opportunityScoresSchema,
  mediaRightsClassification: mediaRightsSchema,
  articleAngleRecommendations: z.array(z.string().min(1).max(300)).min(1).max(5),
  videoAngleRecommendations: z.array(z.string().min(1).max(300)).max(5),
  quickHitRecommendations: z.array(z.string().min(1).max(300)).max(5),
});

export const sourcedTextBlockSchema = z.object({
  text: z.string().min(1).max(3_000),
  claimIds: z.array(z.string().min(1).max(100)).min(1),
});

export const articleDraftSchema = z.object({
  status: z.literal("DRAFTING"),
  workingHeadline: z.string().min(10).max(160),
  dek: z.string().min(10).max(240),
  summary: z.string().min(20).max(500),
  verificationStatus: verificationStatusSchema,
  introduction: z.array(sourcedTextBlockSchema).min(1).max(3),
  bodySections: z.array(
    z.object({
      heading: z.string().min(1).max(160),
      paragraphs: z.array(sourcedTextBlockSchema).min(1),
    }),
  ).min(1),
  whyItMatters: z.array(sourcedTextBlockSchema).min(1),
  confirmedFacts: z.array(sourcedTextBlockSchema).min(1),
  necessaryContext: z.array(sourcedTextBlockSchema),
  limitations: z.array(z.string().min(1).max(500)),
  sourceEvidenceIds: z.array(evidenceIdSchema).min(1),
  relatedEvergreenPath: z.string().startsWith("/").nullable(),
  relatedStoryIds: z.array(z.uuid()).max(6),
  relatedVideoIds: z.array(z.uuid()).max(6),
  authorAttribution: z.string().min(1).max(200),
  proposedPublishedAt: z.null(),
  proposedUpdatedAt: z.null(),
  correctionsReady: z.boolean(),
});

export const seoPackageSchema = z.object({
  primarySearchIntent: z.string().min(1).max(300),
  primaryTopic: z.string().min(1).max(160),
  secondaryTopics: z.array(z.string().min(1).max(160)).max(10),
  stableSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  h1: z.string().min(10).max(160),
  seoTitle: z.string().min(10).max(160),
  metaDescription: z.string().min(20).max(320),
  canonicalPath: z.string().startsWith("/"),
  openGraphTitle: z.string().min(10).max(160),
  openGraphDescription: z.string().min(20).max(320),
  socialImageRecommendation: z.string().min(1).max(500),
  breadcrumbTitle: z.string().min(1).max(120),
  articleSchemaFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  internalLinks: z.array(internalLinkSuggestionSchema).max(8),
  relatedEvergreenHub: z.string().startsWith("/").nullable(),
  evergreenUpdate: z.object({
    recommended: z.boolean(),
    path: z.string().startsWith("/").nullable(),
    suggestion: z.string().max(1_000).nullable(),
  }),
  imageAltTextRecommendations: z.array(z.string().min(1).max(300)).max(8),
  freshnessFields: z.object({
    sourcePublishedAt: z.iso.datetime().nullable(),
    meaningfullyUpdatedAt: z.null(),
    reviewAfter: z.iso.datetime().nullable(),
  }),
  duplicateContentAssessment: z.object({
    risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
    reason: z.string().min(1).max(500),
  }),
  seoOpportunity: z.string().min(1).max(500),
  measuredSearchVolume: z.null(),
});

const visualSuggestionSchema = z.object({
  scene: z.string().min(1).max(500),
  rightsClassification: mediaRightsSchema,
  sourceUrl: z.url().nullable(),
});

export const primaryVideoPackageSchema = z.object({
  targetDurationSeconds: z.number().int().min(61).max(90),
  hookOptions: z.array(z.string().min(1).max(200)).length(3),
  recommendedHook: z.string().min(1).max(200),
  timedVoiceover: z.array(
    z.object({ startSecond: z.number().min(0), endSecond: z.number().max(90), text: z.string().min(1), claimIds: z.array(z.string()).min(1) }),
  ).min(2),
  shotList: z.array(z.object({ startSecond: z.number().min(0), endSecond: z.number().max(90), visual: visualSuggestionSchema, onScreenText: z.string().max(200), caption: z.string().max(300) })).min(2),
  viewerQuestion: z.string().min(1).max(200),
  endingStrategy: z.string().min(1).max(300),
  tiktok: z.object({ title: z.string().max(200), caption: z.string().max(2_200) }),
  youtubeShorts: z.object({ title: z.string().max(200), description: z.string().max(5_000) }),
  instagramCaption: z.string().max(2_200),
  facebookCaption: z.string().max(5_000),
  hashtags: z.array(z.string().regex(/^#[A-Za-z0-9_]+$/)).max(12),
});

export const quickHitPackageSchema = z.object({
  targetDurationSeconds: z.literal(13),
  timeline: z.tuple([
    z.object({ startSecond: z.literal(0), endSecond: z.literal(2), purpose: z.literal("HOOK"), voiceover: z.string().min(1), claimIds: z.array(z.string()).min(1) }),
    z.object({ startSecond: z.literal(2), endSecond: z.literal(10), purpose: z.literal("FACTUAL_PAYOFF"), voiceover: z.string().min(1), claimIds: z.array(z.string()).min(1) }),
    z.object({ startSecond: z.literal(10), endSecond: z.literal(13), purpose: z.literal("QUESTION_OR_LOOP"), voiceover: z.string().min(1), claimIds: z.array(z.string()).min(1) }),
  ]),
  onScreenText: z.array(z.string().min(1).max(160)).min(1).max(5),
  visualSequence: z.array(visualSuggestionSchema).min(1).max(5),
  caption: z.string().min(1).max(2_200),
  platformTitleVariants: z.object({ tiktok: z.string().max(200), youtubeShorts: z.string().max(200), instagram: z.string().max(200), facebook: z.string().max(200) }),
  rightsSafeVisualRecommendation: visualSuggestionSchema,
  relatedPrimaryVideoIdea: z.string().min(1).max(500),
  relatedArticleId: z.uuid().nullable(),
});

export type ResearchPacket = z.infer<typeof researchPacketSchema>;
export type ResearchClaim = z.infer<typeof researchClaimSchema>;
export type ArticleDraft = z.infer<typeof articleDraftSchema>;
export type SeoPackage = z.infer<typeof seoPackageSchema>;
export type PrimaryVideoPackage = z.infer<typeof primaryVideoPackageSchema>;
export type QuickHitPackage = z.infer<typeof quickHitPackageSchema>;
