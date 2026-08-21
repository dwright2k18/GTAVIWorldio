import "server-only";

import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";

import { db, sqlClient } from "@/db";
import {
  authors,
  categories,
  corrections,
  evergreenPages,
  evergreenRevisions,
  evergreenSources,
  mediaAssets,
  redirects,
  sources,
  stories,
  storyEvergreenLinks,
  storyRelations,
  storySources,
  storyTags,
  storyVideos,
  tags,
  videos,
} from "@/db/schema";

const liveStoryStatuses = ["PUBLISHED", "UPDATED"] as const;

function liveStoryWhere() {
  return and(
    inArray(stories.status, [...liveStoryStatuses]),
    lte(stories.publishedAt, new Date()),
  );
}

export async function getPublishedStoryBySlug(slug: string) {
  const [record] = await db
    .select({
      story: stories,
      author: authors,
      category: categories,
      source: sources,
      heroMedia: mediaAssets,
    })
    .from(stories)
    .leftJoin(authors, eq(stories.authorId, authors.id))
    .leftJoin(categories, eq(stories.categoryId, categories.id))
    .leftJoin(sources, eq(stories.primarySourceId, sources.id))
    .leftJoin(mediaAssets, eq(stories.heroMediaId, mediaAssets.id))
    .where(and(eq(stories.slug, slug.toLowerCase()), liveStoryWhere()))
    .limit(1);

  if (!record) return null;

  const tagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(storyTags)
    .innerJoin(tags, eq(storyTags.tagId, tags.id))
    .where(eq(storyTags.storyId, record.story.id));
  const relatedRows = await db
    .select({ id: stories.id, headline: stories.headline, slug: stories.slug, summary: stories.summary, verificationStatus: stories.verificationStatus, publishedAt: stories.publishedAt })
    .from(storyRelations)
    .innerJoin(stories, eq(storyRelations.relatedStoryId, stories.id))
    .where(and(eq(storyRelations.storyId, record.story.id), liveStoryWhere()))
    .orderBy(asc(storyRelations.sortOrder))
    .limit(6);
  const videoRows = await db
    .select({ id: videos.id, title: videos.title, kind: videos.kind, contentUrl: videos.contentUrl, durationSeconds: videos.durationSeconds })
    .from(storyVideos)
    .innerJoin(videos, eq(storyVideos.videoId, videos.id))
    .where(and(eq(storyVideos.storyId, record.story.id), eq(videos.isPublished, true)))
    .orderBy(asc(storyVideos.sortOrder));
  const evergreenRows = await db
    .select({ id: evergreenPages.id, title: evergreenPages.title, path: evergreenPages.path })
    .from(storyEvergreenLinks)
    .innerJoin(evergreenPages, eq(storyEvergreenLinks.evergreenPageId, evergreenPages.id))
    .where(and(eq(storyEvergreenLinks.storyId, record.story.id), eq(evergreenPages.status, "PUBLISHED")));
  const correctionRows = await db
    .select()
    .from(corrections)
    .where(and(eq(corrections.storyId, record.story.id), eq(corrections.isPublic, true)))
    .orderBy(asc(corrections.correctedAt));
  const sourceRows = await db
    .select({ source: sources, isPrimary: storySources.isPrimary, evidenceNotes: storySources.evidenceNotes })
    .from(storySources)
    .innerJoin(sources, eq(storySources.sourceId, sources.id))
    .where(eq(storySources.storyId, record.story.id))
    .orderBy(asc(storySources.sortOrder));

  return { ...record, tags: tagRows, relatedStories: relatedRows, relatedVideos: videoRows, evergreenLinks: evergreenRows, corrections: correctionRows, sources: sourceRows };
}

export async function getEditorialRedirect(path: string) {
  const [record] = await db
    .select({ newPath: redirects.newPath, statusCode: redirects.statusCode })
    .from(redirects)
    .where(and(eq(redirects.oldPath, path.toLowerCase()), eq(redirects.isActive, true)))
    .limit(1);
  return record ?? null;
}

export type CmsSearchResult = {
  id: string;
  headline: string;
  slug: string;
  urlPath: string;
  summary: string;
  verificationStatus: string;
  categoryName: string | null;
  publishedAt: Date;
  rank: number;
};

export async function searchPublishedCms(query: string) {
  const normalized = query.replace(/\s+/g, " ").trim().slice(0, 160);
  if (normalized.length < 2) return [];

  return sqlClient<CmsSearchResult[]>`
    select
      s.id,
      s.headline,
      s.slug,
      s.url_path as "urlPath",
      s.summary,
      s.verification_status::text as "verificationStatus",
      c.name as "categoryName",
      s.published_at as "publishedAt",
      ts_rank(
        to_tsvector(
          'english',
          coalesce(s.headline, '') || ' ' || coalesce(s.summary, '') || ' ' ||
          coalesce(s.body_text, '') || ' ' || coalesce(c.name, '') || ' ' ||
          coalesce(s.subcategory, '') || ' ' || s.verification_status::text || ' ' ||
          coalesce((select string_agg(t.name, ' ') from public.story_tags st join public.tags t on t.id = st.tag_id where st.story_id = s.id), '')
        ),
        websearch_to_tsquery('english', ${normalized})
      )::float as rank
    from public.stories s
    left join public.categories c on c.id = s.category_id
    where s.status in ('PUBLISHED', 'UPDATED')
      and s.published_at <= now()
      and to_tsvector(
        'english',
        coalesce(s.headline, '') || ' ' || coalesce(s.summary, '') || ' ' ||
        coalesce(s.body_text, '') || ' ' || coalesce(c.name, '') || ' ' ||
        coalesce(s.subcategory, '') || ' ' || s.verification_status::text || ' ' ||
        coalesce((select string_agg(t.name, ' ') from public.story_tags st join public.tags t on t.id = st.tag_id where st.story_id = s.id), '')
      ) @@ websearch_to_tsquery('english', ${normalized})
    order by rank desc, s.published_at desc
    limit 30
  `;
}

export async function listPublishedArchive(page = 1, pageSize = 20) {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  return db
    .select({
      id: stories.id,
      headline: stories.headline,
      slug: stories.slug,
      urlPath: stories.urlPath,
      summary: stories.summary,
      verificationStatus: stories.verificationStatus,
      publishedAt: stories.publishedAt,
      categoryName: categories.name,
      authorName: authors.name,
    })
    .from(stories)
    .leftJoin(categories, eq(stories.categoryId, categories.id))
    .leftJoin(authors, eq(stories.authorId, authors.id))
    .where(liveStoryWhere())
    .orderBy(desc(stories.publishedAt))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);
}

export async function listSitemapRecords() {
  const storyRows = await db.select({ path: stories.urlPath, updatedAt: stories.meaningfullyUpdatedAt, publishedAt: stories.publishedAt, robotsOverride: stories.robotsOverride }).from(stories).where(liveStoryWhere());
  const evergreenRows = await db.select({ path: evergreenPages.path, updatedAt: evergreenPages.meaningfullyUpdatedAt, publishedAt: evergreenPages.publishedAt, robotsOverride: evergreenPages.robotsOverride }).from(evergreenPages).where(eq(evergreenPages.status, "PUBLISHED"));
  const authorRows = await db.select({ slug: authors.slug, updatedAt: authors.updatedAt }).from(authors).innerJoin(stories, eq(stories.authorId, authors.id)).where(liveStoryWhere()).groupBy(authors.id);
  return { stories: storyRows, evergreen: evergreenRows, authors: authorRows };
}

export async function getPublicAuthor(slug: string) {
  const [author] = await db.select().from(authors).where(and(eq(authors.slug, slug.toLowerCase()), eq(authors.isActive, true))).limit(1);
  if (!author) return null;
  const history = await db
    .select({ id: stories.id, headline: stories.headline, urlPath: stories.urlPath, summary: stories.summary, publishedAt: stories.publishedAt, verificationStatus: stories.verificationStatus })
    .from(stories)
    .where(and(eq(stories.authorId, author.id), liveStoryWhere()))
    .orderBy(desc(stories.publishedAt));
  return history.length ? { author, stories: history } : null;
}

export async function getPublishedEvergreenByPath(path: string) {
  const [page] = await db
    .select({ page: evergreenPages, author: authors })
    .from(evergreenPages)
    .leftJoin(authors, eq(evergreenPages.authorId, authors.id))
    .where(and(eq(evergreenPages.path, path.toLowerCase()), eq(evergreenPages.status, "PUBLISHED")))
    .limit(1);
  if (!page) return null;

  const sourceRows = await db.select({ source: sources, evidenceNotes: evergreenSources.evidenceNotes }).from(evergreenSources).innerJoin(sources, eq(evergreenSources.sourceId, sources.id)).where(eq(evergreenSources.evergreenPageId, page.page.id)).orderBy(asc(evergreenSources.sortOrder));
  const storyRows = await db.select({ id: stories.id, headline: stories.headline, urlPath: stories.urlPath, summary: stories.summary, publishedAt: stories.publishedAt, verificationStatus: stories.verificationStatus }).from(storyEvergreenLinks).innerJoin(stories, eq(storyEvergreenLinks.storyId, stories.id)).where(and(eq(storyEvergreenLinks.evergreenPageId, page.page.id), liveStoryWhere())).orderBy(desc(stories.publishedAt)).limit(12);
  const revisionRows = await db.select({ id: evergreenRevisions.id, fieldsChanged: evergreenRevisions.fieldsChanged, changeReason: evergreenRevisions.changeReason, createdAt: evergreenRevisions.createdAt }).from(evergreenRevisions).where(eq(evergreenRevisions.evergreenPageId, page.page.id)).orderBy(desc(evergreenRevisions.createdAt)).limit(10);

  return { ...page, sources: sourceRows, relatedStories: storyRows, updateHistory: revisionRows };
}
