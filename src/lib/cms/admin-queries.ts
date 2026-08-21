import "server-only";

import { asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  authors,
  categories,
  corrections,
  discoveryAlerts,
  discoveryCandidates,
  evergreenPages,
  evergreenRevisions,
  evergreenSources,
  mediaAssets,
  redirects,
  sources,
  stories,
  storyEvergreenLinks,
  storyRelations,
  storyRevisions,
  storySources,
  storyTags,
  storyVideos,
  tags,
  type EditorProfile,
  videos,
} from "@/db/schema";
import { evaluateStorySeo } from "@/lib/cms/seo";

export async function getAdminDashboard(editor: EditorProfile) {
  const statusCounts = await db
    .select({ status: stories.status, total: count() })
    .from(stories)
    .groupBy(stories.status);

  const scheduled = await db
    .select({ id: stories.id, headline: stories.headline, scheduledFor: stories.scheduledFor, scheduledTimezone: stories.scheduledTimezone })
    .from(stories)
    .where(eq(stories.status, "SCHEDULED"))
    .orderBy(asc(stories.scheduledFor))
    .limit(5);

  const staleEvergreen = await db
    .select({ id: evergreenPages.id, title: evergreenPages.title, lastReviewedAt: evergreenPages.lastReviewedAt })
    .from(evergreenPages)
    .where(inArray(evergreenPages.status, ["PUBLISHED", "NEEDS_REVIEW"]))
    .orderBy(asc(evergreenPages.lastReviewedAt))
    .limit(5);

  const candidateCounts = editor.role === "AUTHOR" ? [] : await db
      .select({ status: discoveryCandidates.status, total: count() })
      .from(discoveryCandidates)
      .groupBy(discoveryCandidates.status);

  const discoveryAlertRows = editor.role === "AUTHOR" ? [] : await db
      .select()
      .from(discoveryAlerts)
      .where(inArray(discoveryAlerts.status, ["NEW", "ACKNOWLEDGED"]))
      .orderBy(desc(discoveryAlerts.priority), desc(discoveryAlerts.createdAt))
      .limit(5);

  return {
    counts: Object.fromEntries(statusCounts.map((row) => [row.status, Number(row.total)])),
    candidateCounts: Object.fromEntries(candidateCounts.map((row) => [row.status, Number(row.total)])),
    discoveryAlerts: discoveryAlertRows,
    scheduled,
    staleEvergreen,
  };
}

export async function listAdminStories() {
  return db
    .select({
      id: stories.id,
      headline: stories.headline,
      slug: stories.slug,
      urlPath: stories.urlPath,
      status: stories.status,
      verificationStatus: stories.verificationStatus,
      contentType: stories.contentType,
      updatedAt: stories.updatedAt,
      scheduledFor: stories.scheduledFor,
      authorName: authors.name,
      categoryName: categories.name,
    })
    .from(stories)
    .leftJoin(authors, eq(stories.authorId, authors.id))
    .leftJoin(categories, eq(stories.categoryId, categories.id))
    .orderBy(desc(stories.updatedAt));
}

export async function getAdminStory(id: string) {
  const [record] = await db
    .select({
      story: stories,
      authorName: authors.name,
      categoryName: categories.name,
      sourceName: sources.name,
    })
    .from(stories)
    .leftJoin(authors, eq(stories.authorId, authors.id))
    .leftJoin(categories, eq(stories.categoryId, categories.id))
    .leftJoin(sources, eq(stories.primarySourceId, sources.id))
    .where(eq(stories.id, id))
    .limit(1);

  if (!record) return null;

  // Supabase's transaction pool can stall when postgres-js pipelines several
  // statements concurrently. Keep these small newsroom reads sequential.
  const tagRows = await db
    .select({ tagId: storyTags.tagId })
    .from(storyTags)
    .where(eq(storyTags.storyId, id));
  const relationRows = await db
    .select({ relatedStoryId: storyRelations.relatedStoryId })
    .from(storyRelations)
    .where(eq(storyRelations.storyId, id));
  const videoRows = await db
    .select({ videoId: storyVideos.videoId })
    .from(storyVideos)
    .where(eq(storyVideos.storyId, id));
  const evergreenRows = await db
    .select({ evergreenPageId: storyEvergreenLinks.evergreenPageId })
    .from(storyEvergreenLinks)
    .where(eq(storyEvergreenLinks.storyId, id));
  const correctionRows = await db
    .select()
    .from(corrections)
    .where(eq(corrections.storyId, id))
    .orderBy(desc(corrections.correctedAt));
  const revisionRows = await db
    .select()
    .from(storyRevisions)
    .where(eq(storyRevisions.storyId, id))
    .orderBy(desc(storyRevisions.createdAt))
    .limit(20);
  const sourceRows = await db
    .select({
      source: sources,
      isPrimary: storySources.isPrimary,
      evidenceNotes: storySources.evidenceNotes,
    })
    .from(storySources)
    .innerJoin(sources, eq(storySources.sourceId, sources.id))
    .where(eq(storySources.storyId, id));

  return {
    ...record,
    tagIds: tagRows.map((row) => row.tagId),
    relatedStoryIds: relationRows.map((row) => row.relatedStoryId),
    relatedVideoIds: videoRows.map((row) => row.videoId),
    evergreenPageIds: evergreenRows.map((row) => row.evergreenPageId),
    corrections: correctionRows,
    revisions: revisionRows,
    sourceRecords: sourceRows,
  };
}

export async function getStoryFormOptions() {
  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name));
  const authorRows = await db
    .select()
    .from(authors)
    .where(eq(authors.isActive, true))
    .orderBy(asc(authors.name));
  const sourceRows = await db.select().from(sources).orderBy(asc(sources.name));
  const tagRows = await db
    .select()
    .from(tags)
    .where(eq(tags.isActive, true))
    .orderBy(asc(tags.name));
  const storyRows = await db
    .select({ id: stories.id, headline: stories.headline, status: stories.status })
    .from(stories)
    .orderBy(asc(stories.headline));
  const videoRows = await db
    .select({ id: videos.id, title: videos.title, kind: videos.kind })
    .from(videos)
    .orderBy(asc(videos.title));
  const evergreenRows = await db
    .select({ id: evergreenPages.id, title: evergreenPages.title, path: evergreenPages.path })
    .from(evergreenPages)
    .orderBy(asc(evergreenPages.title));
  const mediaRows = await db
    .select({ id: mediaAssets.id, url: mediaAssets.url, altText: mediaAssets.altText })
    .from(mediaAssets)
    .where(eq(mediaAssets.mediaType, "IMAGE"))
    .orderBy(desc(mediaAssets.createdAt));

  return { categories: categoryRows, authors: authorRows, sources: sourceRows, tags: tagRows, stories: storyRows, videos: videoRows, evergreenPages: evergreenRows, media: mediaRows };
}

export async function getSeoHealthReport() {
  const storyRows = await db.select().from(stories).orderBy(desc(stories.updatedAt));
  const relationCounts = await db
    .select({ storyId: storyRelations.storyId, total: count() })
    .from(storyRelations)
    .groupBy(storyRelations.storyId);
  const duplicateTitles = await db
    .select({ headline: stories.headline, total: count() })
    .from(stories)
    .groupBy(stories.headline);
  const mediaRows = await db
    .select({ id: mediaAssets.id, altText: mediaAssets.altText })
    .from(mediaAssets);
  const redirectRows = await db
    .select()
    .from(redirects)
    .where(eq(redirects.isActive, true));

  const relationMap = new Map(relationCounts.map((row) => [row.storyId, Number(row.total)]));
  const duplicateSet = new Set(duplicateTitles.filter((row) => Number(row.total) > 1).map((row) => row.headline));

  return {
    stories: storyRows.map((story) => ({
      id: story.id,
      headline: story.headline,
      status: story.status,
      duplicateTitle: duplicateSet.has(story.headline),
      ...evaluateStorySeo({ ...story, relatedCount: relationMap.get(story.id) ?? 0 }),
    })),
    mediaMissingAlt: mediaRows.filter((media) => !media.altText).length,
    redirects: redirectRows,
  };
}

export async function listSourcesWithUsage() {
  const usage = await db
    .select({ sourceId: storySources.sourceId, total: count() })
    .from(storySources)
    .groupBy(storySources.sourceId);
  const usageMap = new Map(usage.map((row) => [row.sourceId, Number(row.total)]));
  const rows = await db.select().from(sources).orderBy(asc(sources.name));
  return rows.map((source) => ({ ...source, usage: usageMap.get(source.id) ?? 0 }));
}

export async function listTaxonomy() {
  const categoryRows = await db.select().from(categories).orderBy(asc(categories.name));
  const tagRows = await db.select().from(tags).orderBy(asc(tags.name));
  const tagUsage = await db
    .select({ tagId: storyTags.tagId, total: count() })
    .from(storyTags)
    .groupBy(storyTags.tagId);
  const usageMap = new Map(tagUsage.map((row) => [row.tagId, Number(row.total)]));
  return { categories: categoryRows, tags: tagRows.map((tag) => ({ ...tag, usage: usageMap.get(tag.id) ?? 0 })) };
}

export async function listAuthorsWithHistory() {
  const history = await db.select({ authorId: stories.authorId, total: count() }).from(stories).groupBy(stories.authorId);
  const historyMap = new Map(history.map((row) => [row.authorId, Number(row.total)]));
  const rows = await db.select().from(authors).orderBy(asc(authors.name));
  return rows.map((author) => ({ ...author, storyCount: historyMap.get(author.id) ?? 0 }));
}

export async function listMediaAssets() {
  return db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt));
}

export async function listVideos() {
  return db
    .select({
      video: videos,
      thumbnailUrl: mediaAssets.url,
      thumbnailAlt: mediaAssets.altText,
    })
    .from(videos)
    .leftJoin(mediaAssets, eq(videos.thumbnailMediaId, mediaAssets.id))
    .orderBy(desc(videos.createdAt));
}

export async function listEvergreenAdmin() {
  const pageRows = await db.select().from(evergreenPages).orderBy(asc(evergreenPages.title));
  const sourceLinks = await db.select().from(evergreenSources);
  const revisionRows = await db
    .select({
      id: evergreenRevisions.id,
      evergreenPageId: evergreenRevisions.evergreenPageId,
      revisionNumber: evergreenRevisions.revisionNumber,
      fieldsChanged: evergreenRevisions.fieldsChanged,
      changeReason: evergreenRevisions.changeReason,
      createdAt: evergreenRevisions.createdAt,
    })
    .from(evergreenRevisions)
    .orderBy(desc(evergreenRevisions.createdAt));
  const sourceOptions = await db.select().from(sources).orderBy(asc(sources.name));
  const authorOptions = await db
    .select()
    .from(authors)
    .where(eq(authors.isActive, true))
    .orderBy(asc(authors.name));

  return {
    pages: pageRows.map((page) => ({
      ...page,
      sourceIds: sourceLinks.filter((link) => link.evergreenPageId === page.id).map((link) => link.sourceId),
      revisions: revisionRows.filter((revision) => revision.evergreenPageId === page.id).slice(0, 10),
    })),
    sources: sourceOptions,
    authors: authorOptions,
  };
}
