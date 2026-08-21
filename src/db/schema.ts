import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const verificationStatusEnum = pgEnum("verification_status", [
  "CONFIRMED",
  "CREDIBLE_REPORT",
  "RUMOR",
  "SPECULATION",
  "ALLEGED_LEAK",
]);

export const storyStatusEnum = pgEnum("story_status", [
  "DISCOVERED",
  "RESEARCHING",
  "DRAFTING",
  "NEEDS_REVIEW",
  "FACT_CHECK",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "UPDATED",
  "ARCHIVED",
  "REJECTED",
]);

export const contentTypeEnum = pgEnum("content_type", [
  "NEWS",
  "FEATURE",
  "ANALYSIS",
  "GUIDE",
  "EVERGREEN",
  "VIDEO",
]);

export const editorRoleEnum = pgEnum("editor_role", [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "AUTHOR",
  "FACT_CHECKER",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "FIRST_PARTY",
  "PRESS_RELEASE",
  "INVESTOR_REPORT",
  "INTERVIEW",
  "JOURNALISM",
  "PUBLIC_RECORD",
  "COMMUNITY_DISCOVERY",
  "SOCIAL_POST",
  "OTHER",
]);

export const mediaTypeEnum = pgEnum("media_type", [
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
]);

export const videoKindEnum = pgEnum("video_kind", [
  "PRIMARY",
  "QUICK_HIT",
  "TRAILER",
  "CLIP",
]);

export const correctionSignificanceEnum = pgEnum(
  "correction_significance",
  ["MATERIAL", "NON_MATERIAL"],
);

export const relationTypeEnum = pgEnum("story_relation_type", [
  "RELATED",
  "FOLLOW_UP",
  "BACKGROUND",
  "CORRECTION",
]);

export const evergreenStatusEnum = pgEnum("evergreen_status", [
  "DRAFT",
  "NEEDS_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
]);

export const sourceAuthorityTierEnum = pgEnum("source_authority_tier", [
  "TIER_1",
  "TIER_2",
  "TIER_3",
  "TIER_4",
]);

export const sourceConnectorKindEnum = pgEnum("source_connector_kind", [
  "RSS",
  "ATOM",
  "HTML_LISTING",
  "HTML_CHANGE",
  "JSON_FEED",
  "MANUAL",
]);

export const sourceHealthStatusEnum = pgEnum("source_health_status", [
  "NOT_CHECKED",
  "HEALTHY",
  "DEGRADED",
  "FAILED",
  "PAUSED",
  "CIRCUIT_OPEN",
]);

export const fetchRunStatusEnum = pgEnum("fetch_run_status", [
  "SUCCESS",
  "PARTIAL",
  "FAILED",
  "SKIPPED",
  "CIRCUIT_OPEN",
  "TEST_ONLY",
]);

export const sourceChangeTypeEnum = pgEnum("source_change_type", [
  "NEW_ARTICLE",
  "TEXT_UPDATE",
  "RELEASE_DATE_CHANGE",
  "PLATFORM_CHANGE",
  "PRICE_CHANGE",
  "PREORDER_CHANGE",
  "TRAILER_ADDED",
  "SCREENSHOT_ADDED",
  "METADATA_CHANGE",
  "UNKNOWN",
]);

export const candidateStatusEnum = pgEnum("candidate_status", [
  "DISCOVERED",
  "TRIAGED",
  "RESEARCHING",
  "DUPLICATE",
  "REJECTED",
  "PROMOTED_TO_STORY",
  "ARCHIVED",
]);

export const duplicateStatusEnum = pgEnum("duplicate_status", [
  "NEW_STORY",
  "RELATED",
  "LIKELY_DUPLICATE",
  "DUPLICATE",
]);

export const clusterStatusEnum = pgEnum("cluster_status", [
  "OPEN",
  "MONITORING",
  "RESOLVED",
  "MERGED",
  "ARCHIVED",
]);

export const mediaRightsStatusEnum = pgEnum("media_rights_status", [
  "OFFICIAL_EMBEDDABLE",
  "OWNED",
  "LICENSED",
  "COMMENTARY_ONLY",
  "DO_NOT_HOST",
  "UNKNOWN_RIGHTS",
]);

export const discoveryAlertTypeEnum = pgEnum("discovery_alert_type", [
  "URGENT_OFFICIAL_UPDATE",
  "HIGH_VALUE_SEO_OPPORTUNITY",
  "POSSIBLE_DUPLICATE",
  "CONFLICTING_SOURCES",
  "ALLEGED_LEAK_TRENDING",
  "EVERGREEN_PAGE_NEEDS_UPDATE",
  "SOURCE_CONNECTOR_FAILURE",
  "COST_LIMIT_WARNING",
]);

export const discoveryAlertStatusEnum = pgEnum("discovery_alert_status", [
  "NEW",
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
]);

export const discoveryActorTypeEnum = pgEnum("discovery_actor_type", [
  "MANUAL",
  "AUTOMATION",
]);

export type ArticleBodyBlock =
  | { type: "paragraph"; content: string }
  | { type: "heading"; level: 2 | 3; content: string }
  | { type: "quote"; content: string; attribution?: string }
  | { type: "list"; ordered?: boolean; items: string[] };

export const authors = pgTable(
  "authors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    bio: text("bio"),
    role: text("role"),
    profileImageUrl: text("profile_image_url"),
    profileImageAlt: text("profile_image_alt"),
    socialLinks: jsonb("social_links")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    expertiseAreas: text("expertise_areas").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("authors_slug_lower_uidx").on(table.slug)],
);

export const editorProfiles = pgTable(
  "editor_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: uuid("auth_user_id").notNull().unique(),
    authorId: uuid("author_id").references(() => authors.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    role: editorRoleEnum("role").notNull().default("AUTHOR"),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("editor_profiles_role_idx").on(table.role)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentCode: text("parent_code"),
    isIndexable: boolean("is_indexable").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("categories_code_lower_uidx").on(table.code),
    uniqueIndex("categories_slug_lower_uidx").on(table.slug),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isIndexable: boolean("is_indexable").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("tags_slug_lower_uidx").on(table.slug)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull().default("OTHER"),
    publication: text("publication"),
    authorName: text("author_name"),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    isFirstParty: boolean("is_first_party").notNull().default(false),
    reliabilityNotes: text("reliability_notes"),
    verificationNotes: text("verification_notes"),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sources_url_uidx").on(table.url),
    index("sources_type_idx").on(table.sourceType),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaType: mediaTypeEnum("media_type").notNull().default("IMAGE"),
    url: text("url").notNull(),
    altText: text("alt_text"),
    caption: text("caption"),
    credit: text("credit"),
    sourceUrl: text("source_url"),
    licenseNotes: text("license_notes"),
    width: integer("width"),
    height: integer("height"),
    mimeType: text("mime_type"),
    focalPoint: text("focal_point"),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("media_assets_type_idx").on(table.mediaType)],
);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    headline: text("headline").notNull(),
    slug: text("slug").notNull(),
    urlPath: text("url_path").notNull(),
    subtitle: text("subtitle"),
    summary: text("summary").notNull(),
    body: jsonb("body").$type<ArticleBodyBlock[]>().notNull().default([]),
    bodyText: text("body_text").notNull().default(""),
    contentType: contentTypeEnum("content_type").notNull().default("NEWS"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    subcategory: text("subcategory"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("SPECULATION"),
    status: storyStatusEnum("status").notNull().default("DISCOVERED"),
    authorId: uuid("author_id").references(() => authors.id, {
      onDelete: "restrict",
    }),
    editorId: uuid("editor_id").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    primarySourceId: uuid("primary_source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    originalSourcePublishedAt: timestamp("original_source_published_at", {
      withTimezone: true,
    }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    scheduledTimezone: text("scheduled_timezone").notNull().default("UTC"),
    meaningfullyUpdatedAt: timestamp("meaningfully_updated_at", {
      withTimezone: true,
    }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    heroMediaId: uuid("hero_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    heroImageAlt: text("hero_image_alt"),
    heroImageCaption: text("hero_image_caption"),
    heroImageCredit: text("hero_image_credit"),
    featured: boolean("featured").notNull().default(false),
    breaking: boolean("breaking").notNull().default(false),
    evergreen: boolean("evergreen").notNull().default(false),
    trendingEligible: boolean("trending_eligible").notNull().default(false),
    tiktokUrl: text("tiktok_url"),
    youtubeUrl: text("youtube_url"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    canonicalOverride: text("canonical_override"),
    seoTitleOverride: text("seo_title_override"),
    metaDescriptionOverride: text("meta_description_override"),
    openGraphTitleOverride: text("open_graph_title_override"),
    openGraphDescriptionOverride: text("open_graph_description_override"),
    openGraphImageId: uuid("open_graph_image_id").references(
      () => mediaAssets.id,
      { onDelete: "set null" },
    ),
    robotsOverride: text("robots_override"),
    structuredData: jsonb("structured_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    internalNotes: text("internal_notes"),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stories_slug_lower_uidx").on(table.slug),
    uniqueIndex("stories_url_path_lower_uidx").on(table.urlPath),
    index("stories_status_published_idx").on(table.status, table.publishedAt),
    index("stories_category_published_idx").on(
      table.categoryId,
      table.publishedAt,
    ),
    index("stories_verification_idx").on(table.verificationStatus),
    index("stories_updated_idx").on(table.meaningfullyUpdatedAt),
    index("stories_scheduled_idx").on(table.status, table.scheduledFor),
    index("stories_featured_idx").on(table.featured, table.publishedAt),
    index("stories_breaking_idx").on(table.breaking, table.publishedAt),
  ],
);

export const storyTags = pgTable(
  "story_tags",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.tagId] }),
    index("story_tags_tag_idx").on(table.tagId),
  ],
);

export const storySources = pgTable(
  "story_sources",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    evidenceNotes: text("evidence_notes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.sourceId] }),
    index("story_sources_source_idx").on(table.sourceId),
  ],
);

export const storyRelations = pgTable(
  "story_relations",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    relatedStoryId: uuid("related_story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    relationType: relationTypeEnum("relation_type")
      .notNull()
      .default("RELATED"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.relatedStoryId] }),
    index("story_relations_related_idx").on(table.relatedStoryId),
  ],
);

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: videoKindEnum("kind").notNull().default("PRIMARY"),
    title: text("title").notNull(),
    description: text("description"),
    thumbnailMediaId: uuid("thumbnail_media_id").references(
      () => mediaAssets.id,
      { onDelete: "set null" },
    ),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    platform: text("platform"),
    embedUrl: text("embed_url"),
    contentUrl: text("content_url"),
    transcript: text("transcript"),
    captionsUrl: text("captions_url"),
    tiktokUrl: text("tiktok_url"),
    youtubeUrl: text("youtube_url"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    isPublished: boolean("is_published").notNull().default(false),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("videos_kind_published_idx").on(table.kind, table.isPublished),
  ],
);

export const storyVideos = pgTable(
  "story_videos",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("RELATED"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.videoId] }),
    index("story_videos_video_idx").on(table.videoId),
  ],
);

export const corrections = pgTable(
  "corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    originalIssue: text("original_issue").notNull(),
    correction: text("correction").notNull(),
    significance: correctionSignificanceEnum("significance").notNull(),
    editorId: uuid("editor_id").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    isPublic: boolean("is_public").notNull().default(false),
    correctedAt: timestamp("corrected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("corrections_story_date_idx").on(table.storyId, table.correctedAt)],
);

export const storyRevisions = pgTable(
  "story_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    editorId: uuid("editor_id").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    authUserId: uuid("auth_user_id"),
    fieldsChanged: text("fields_changed").array().notNull().default([]),
    previousContent: jsonb("previous_content")
      .$type<Record<string, unknown>>()
      .notNull(),
    newContent: jsonb("new_content")
      .$type<Record<string, unknown>>()
      .notNull(),
    changeReason: text("change_reason"),
    isAiAssisted: boolean("is_ai_assisted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("story_revisions_number_uidx").on(
      table.storyId,
      table.revisionNumber,
    ),
    index("story_revisions_story_date_idx").on(table.storyId, table.createdAt),
  ],
);

export const evergreenPages = pgTable(
  "evergreen_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    path: text("path").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    searchIntent: text("search_intent").notNull(),
    summary: text("summary").notNull(),
    body: jsonb("body").$type<ArticleBodyBlock[]>().notNull().default([]),
    officiallyConfirmed: jsonb("officially_confirmed")
      .$type<ArticleBodyBlock[]>()
      .notNull()
      .default([]),
    recentDevelopments: jsonb("recent_developments")
      .$type<ArticleBodyBlock[]>()
      .notNull()
      .default([]),
    faq: jsonb("faq")
      .$type<Array<{ question: string; answer: string }>>()
      .notNull()
      .default([]),
    status: evergreenStatusEnum("status").notNull().default("DRAFT"),
    seoTitleOverride: text("seo_title_override"),
    metaDescriptionOverride: text("meta_description_override"),
    canonicalOverride: text("canonical_override"),
    robotsOverride: text("robots_override"),
    authorId: uuid("author_id").references(() => authors.id, {
      onDelete: "set null",
    }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    meaningfullyUpdatedAt: timestamp("meaningfully_updated_at", {
      withTimezone: true,
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("evergreen_pages_path_lower_uidx").on(table.path),
    uniqueIndex("evergreen_pages_slug_lower_uidx").on(table.slug),
    index("evergreen_status_reviewed_idx").on(table.status, table.lastReviewedAt),
  ],
);

export const storyEvergreenLinks = pgTable(
  "story_evergreen_links",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    evergreenPageId: uuid("evergreen_page_id")
      .notNull()
      .references(() => evergreenPages.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("RELATED"),
    context: text("context"),
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.evergreenPageId] }),
    index("story_evergreen_page_idx").on(table.evergreenPageId),
  ],
);

export const evergreenSources = pgTable(
  "evergreen_sources",
  {
    evergreenPageId: uuid("evergreen_page_id")
      .notNull()
      .references(() => evergreenPages.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    evidenceNotes: text("evidence_notes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.evergreenPageId, table.sourceId] }),
    index("evergreen_sources_source_idx").on(table.sourceId),
  ],
);

export const evergreenRevisions = pgTable(
  "evergreen_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evergreenPageId: uuid("evergreen_page_id")
      .notNull()
      .references(() => evergreenPages.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    editorId: uuid("editor_id").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    fieldsChanged: text("fields_changed").array().notNull().default([]),
    previousContent: jsonb("previous_content")
      .$type<Record<string, unknown>>()
      .notNull(),
    newContent: jsonb("new_content")
      .$type<Record<string, unknown>>()
      .notNull(),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("evergreen_revisions_number_uidx").on(
      table.evergreenPageId,
      table.revisionNumber,
    ),
    index("evergreen_revisions_page_date_idx").on(
      table.evergreenPageId,
      table.createdAt,
    ),
  ],
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    oldPath: text("old_path").notNull(),
    newPath: text("new_path").notNull(),
    reason: text("reason").notNull(),
    storyId: uuid("story_id").references(() => stories.id, {
      onDelete: "set null",
    }),
    statusCode: integer("status_code").notNull().default(308),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("redirects_old_path_lower_uidx").on(table.oldPath),
    index("redirects_story_idx").on(table.storyId),
  ],
);

export const monitoredSources = pgTable(
  "monitored_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    authorityTier: sourceAuthorityTierEnum("authority_tier").notNull(),
    isFirstParty: boolean("is_first_party").notNull().default(false),
    reliabilityScore: integer("reliability_score").notNull().default(50),
    historicalAccuracyNotes: text("historical_accuracy_notes"),
    connectorKind: sourceConnectorKindEnum("connector_kind").notNull(),
    connectorConfig: jsonb("connector_config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    healthStatus: sourceHealthStatusEnum("health_status")
      .notNull()
      .default("NOT_CHECKED"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessfulFetchAt: timestamp("last_successful_fetch_at", {
      withTimezone: true,
    }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastHttpStatus: integer("last_http_status"),
    lastError: text("last_error"),
    circuitOpenUntil: timestamp("circuit_open_until", { withTimezone: true }),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(false),
    rateLimitPerHour: integer("rate_limit_per_hour").notNull().default(6),
    minCheckIntervalMinutes: integer("min_check_interval_minutes")
      .notNull()
      .default(30),
    termsPolicyNotes: text("terms_policy_notes"),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("monitored_sources_url_uidx").on(table.url),
    index("monitored_sources_active_tier_idx").on(
      table.isActive,
      table.authorityTier,
    ),
    index("monitored_sources_health_idx").on(table.healthStatus),
    index("monitored_sources_next_check_idx").on(table.nextCheckAt),
  ],
);

export const sourceFetchRuns = pgTable(
  "source_fetch_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => monitoredSources.id, { onDelete: "cascade" }),
    status: fetchRunStatusEnum("status").notNull(),
    isTestRun: boolean("is_test_run").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    httpStatus: integer("http_status"),
    requestCount: integer("request_count").notNull().default(0),
    responseBytes: integer("response_bytes").notNull().default(0),
    itemsSeen: integer("items_seen").notNull().default(0),
    candidatesCreated: integer("candidates_created").notNull().default(0),
    duplicatesSkipped: integer("duplicates_skipped").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index("source_fetch_runs_source_date_idx").on(
      table.sourceId,
      table.startedAt,
    ),
    index("source_fetch_runs_status_idx").on(table.status),
  ],
);

export const sourceSnapshots = pgTable(
  "source_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => monitoredSources.id, { onDelete: "cascade" }),
    normalizedUrl: text("normalized_url").notNull(),
    title: text("title"),
    sourceHash: text("source_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    changeType: sourceChangeTypeEnum("change_type")
      .notNull()
      .default("UNKNOWN"),
    meaningfulChange: boolean("meaningful_change").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    uniqueIndex("source_snapshots_source_content_uidx").on(
      table.sourceId,
      table.contentHash,
    ),
    index("source_snapshots_checked_idx").on(table.checkedAt),
  ],
);

export const storyClusters = pgTable(
  "story_clusters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    normalizedEventKey: text("normalized_event_key").notNull(),
    primaryEvent: text("primary_event").notNull(),
    primarySourceId: uuid("primary_source_id").references(
      () => monitoredSources.id,
      { onDelete: "set null" },
    ),
    status: clusterStatusEnum("status").notNull().default("OPEN"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("SPECULATION"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    communityReaction: text("community_reaction"),
    conflictingClaims: jsonb("conflicting_claims")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("story_clusters_event_key_uidx").on(table.normalizedEventKey),
    index("story_clusters_status_seen_idx").on(table.status, table.lastSeenAt),
  ],
);

export const discoveryCandidates = pgTable(
  "discovery_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clusterId: uuid("cluster_id").references(() => storyClusters.id, {
      onDelete: "set null",
    }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => monitoredSources.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    sourceUrl: text("source_url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    sourceAuthor: text("source_author"),
    sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
    excerpt: text("excerpt"),
    sourceHash: text("source_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    changeType: sourceChangeTypeEnum("change_type")
      .notNull()
      .default("NEW_ARTICLE"),
    status: candidateStatusEnum("status").notNull().default("DISCOVERED"),
    duplicateStatus: duplicateStatusEnum("duplicate_status")
      .notNull()
      .default("NEW_STORY"),
    verificationRecommendation: verificationStatusEnum(
      "verification_recommendation",
    )
      .notNull()
      .default("SPECULATION"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    newsworthinessScore: integer("newsworthiness_score").notNull().default(0),
    seoOpportunityScore: integer("seo_opportunity_score")
      .notNull()
      .default(0),
    trendScore: integer("trend_score").notNull().default(0),
    contentOpportunityScore: integer("content_opportunity_score")
      .notNull()
      .default(0),
    quickHitScore: integer("quick_hit_score").notNull().default(0),
    primaryVideoScore: integer("primary_video_score").notNull().default(0),
    primaryTopic: text("primary_topic"),
    secondaryTopics: text("secondary_topics").array().notNull().default([]),
    searchIntent: text("search_intent"),
    suggestedKeywords: text("suggested_keywords").array().notNull().default([]),
    evergreenUpdateRecommended: boolean("evergreen_update_recommended")
      .notNull()
      .default(false),
    evergreenPageId: uuid("evergreen_page_id").references(
      () => evergreenPages.id,
      { onDelete: "set null" },
    ),
    evergreenRecommendation: text("evergreen_recommendation"),
    internalLinkSuggestions: jsonb("internal_link_suggestions")
      .$type<Array<{ path: string; reason: string }>>()
      .notNull()
      .default([]),
    knownFacts: jsonb("known_facts")
      .$type<Array<{ fact: string; sourceUrl: string }>>()
      .notNull()
      .default([]),
    uncertainties: text("uncertainties").array().notNull().default([]),
    exactQuotes: jsonb("exact_quotes")
      .$type<Array<{ text: string; speaker?: string; sourceUrl: string; locator?: string }>>()
      .notNull()
      .default([]),
    conflictingClaims: jsonb("conflicting_claims")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    communityQuestions: text("community_questions").array().notNull().default([]),
    researchNotes: text("research_notes"),
    suggestedHeadline: text("suggested_headline"),
    suggestedSummary: text("suggested_summary"),
    suggestedSeoTitle: text("suggested_seo_title"),
    suggestedMetaDescription: text("suggested_meta_description"),
    suggestedHook: text("suggested_hook"),
    quickHitAngle: text("quick_hit_angle"),
    primaryVideoAngle: text("primary_video_angle"),
    storyAngles: text("story_angles").array().notNull().default([]),
    visualAssetSuggestions: text("visual_asset_suggestions")
      .array()
      .notNull()
      .default([]),
    mediaRightsStatus: mediaRightsStatusEnum("media_rights_status")
      .notNull()
      .default("UNKNOWN_RIGHTS"),
    assignedTo: uuid("assigned_to").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    storyId: uuid("story_id").references(() => stories.id, {
      onDelete: "set null",
    }),
    isTest: boolean("is_test").notNull().default(false),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("discovery_candidates_source_version_uidx").on(
      table.sourceId,
      table.canonicalUrl,
      table.contentHash,
    ),
    index("discovery_candidates_status_priority_idx").on(
      table.status,
      table.newsworthinessScore,
    ),
    index("discovery_candidates_cluster_idx").on(table.clusterId),
    index("discovery_candidates_source_date_idx").on(
      table.sourceId,
      table.discoveredAt,
    ),
    index("discovery_candidates_seo_idx").on(table.seoOpportunityScore),
    index("discovery_candidates_test_idx").on(table.isTest),
  ],
);

export const candidateEvidence = pgTable(
  "candidate_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => discoveryCandidates.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => monitoredSources.id, {
      onDelete: "set null",
    }),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    authorityTier: sourceAuthorityTierEnum("authority_tier").notNull(),
    authorityScore: integer("authority_score").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    isCorroborating: boolean("is_corroborating").notNull().default(false),
    extractedFacts: text("extracted_facts").array().notNull().default([]),
    exactQuotes: jsonb("exact_quotes")
      .$type<Array<{ text: string; speaker?: string; locator?: string }>>()
      .notNull()
      .default([]),
    verificationNotes: text("verification_notes"),
    rightsNotes: text("rights_notes"),
    createdBy: uuid("created_by").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("candidate_evidence_candidate_url_uidx").on(
      table.candidateId,
      table.sourceUrl,
    ),
    index("candidate_evidence_candidate_idx").on(table.candidateId),
  ],
);

export const discoveryAlerts = pgTable(
  "discovery_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateId: uuid("candidate_id").references(() => discoveryCandidates.id, {
      onDelete: "cascade",
    }),
    clusterId: uuid("cluster_id").references(() => storyClusters.id, {
      onDelete: "cascade",
    }),
    sourceId: uuid("source_id").references(() => monitoredSources.id, {
      onDelete: "cascade",
    }),
    alertType: discoveryAlertTypeEnum("alert_type").notNull(),
    status: discoveryAlertStatusEnum("status").notNull().default("NEW"),
    priority: integer("priority").notNull().default(50),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    acknowledgedBy: uuid("acknowledged_by").references(
      () => editorProfiles.id,
      { onDelete: "set null" },
    ),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("discovery_alerts_status_priority_idx").on(
      table.status,
      table.priority,
    ),
  ],
);

export const discoveryAuditLogs = pgTable(
  "discovery_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateId: uuid("candidate_id").references(() => discoveryCandidates.id, {
      onDelete: "set null",
    }),
    clusterId: uuid("cluster_id").references(() => storyClusters.id, {
      onDelete: "set null",
    }),
    storyId: uuid("story_id").references(() => stories.id, {
      onDelete: "set null",
    }),
    actorId: uuid("actor_id").references(() => editorProfiles.id, {
      onDelete: "set null",
    }),
    actorType: discoveryActorTypeEnum("actor_type").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("discovery_audit_candidate_date_idx").on(
      table.candidateId,
      table.createdAt,
    ),
    index("discovery_audit_action_idx").on(table.action),
  ],
);

export const discoverySettings = pgTable("discovery_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  recurringMonitoringEnabled: boolean("recurring_monitoring_enabled")
    .notNull()
    .default(false),
  automaticDraftingEnabled: boolean("automatic_drafting_enabled")
    .notNull()
    .default(false),
  deepResearchEnabled: boolean("deep_research_enabled")
    .notNull()
    .default(false),
  maxRequestsPerDay: integer("max_requests_per_day").notNull().default(100),
  maxCandidatesPerRun: integer("max_candidates_per_run").notNull().default(20),
  maxAiTriageCallsPerDay: integer("max_ai_triage_calls_per_day")
    .notNull()
    .default(0),
  maxAiResearchCallsPerDay: integer("max_ai_research_calls_per_day")
    .notNull()
    .default(0),
  maxEstimatedMonthlyCostCents: integer("max_estimated_monthly_cost_cents")
    .notNull()
    .default(0),
  retentionDays: integer("retention_days").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const discoveryUsageDaily = pgTable(
  "discovery_usage_daily",
  {
    usageDate: text("usage_date").primaryKey(),
    requestCount: integer("request_count").notNull().default(0),
    responseBytes: integer("response_bytes").notNull().default(0),
    candidatesCreated: integer("candidates_created").notNull().default(0),
    aiTriageCalls: integer("ai_triage_calls").notNull().default(0),
    aiResearchCalls: integer("ai_research_calls").notNull().default(0),
    estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("discovery_usage_updated_idx").on(table.updatedAt)],
);

export type StoryRecord = typeof stories.$inferSelect;
export type NewStoryRecord = typeof stories.$inferInsert;
export type EditorProfile = typeof editorProfiles.$inferSelect;
export type MonitoredSource = typeof monitoredSources.$inferSelect;
export type DiscoveryCandidate = typeof discoveryCandidates.$inferSelect;
export type StoryCluster = typeof storyClusters.$inferSelect;
