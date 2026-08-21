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

export type StoryRecord = typeof stories.$inferSelect;
export type NewStoryRecord = typeof stories.$inferInsert;
export type EditorProfile = typeof editorProfiles.$inferSelect;
