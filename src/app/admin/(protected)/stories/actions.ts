"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  corrections,
  redirects,
  stories,
  storyEvergreenLinks,
  storyRelations,
  storySources,
  storyTags,
  storyVideos,
} from "@/db/schema";
import { requireEditorAction, type EditorRole } from "@/lib/auth/dal";
import { storyMutationDenial } from "@/lib/auth/permissions";
import { textToArticleBlocks } from "@/lib/cms/content";
import { parseUtcDateTime, parseZonedDateTime } from "@/lib/cms/datetime";
import { defaultStoryPath, slugifyHeadline } from "@/lib/cms/seo";
import { storyFormData, type StoryInput } from "@/lib/cms/validation";

const seniorRoles: readonly EditorRole[] = ["OWNER", "ADMIN", "EDITOR"];
const factCheckRoles: readonly EditorRole[] = [...seniorRoles, "FACT_CHECKER"];

function desiredStatus(intent: StoryInput["intent"], current?: typeof stories.$inferSelect) {
  if (intent === "review") return "NEEDS_REVIEW" as const;
  if (intent === "fact-check") return "FACT_CHECK" as const;
  if (intent === "approve") return "APPROVED" as const;
  if (intent === "schedule") return "SCHEDULED" as const;
  if (intent === "publish") return current?.publishedAt ? ("UPDATED" as const) : ("PUBLISHED" as const);
  if (intent === "archive") return "ARCHIVED" as const;
  return current?.status ?? ("DRAFTING" as const);
}

function meaningfulPublicChange(current: typeof stories.$inferSelect, next: StoryInput, slug: string) {
  return (
    current.headline !== next.headline ||
    current.slug !== slug ||
    current.summary !== next.summary ||
    current.subtitle !== next.subtitle ||
    current.bodyText !== next.bodyText ||
    current.verificationStatus !== next.verificationStatus ||
    current.authorId !== next.authorId ||
    current.primarySourceId !== next.primarySourceId ||
    current.heroImageAlt !== next.heroImageAlt
  );
}

async function persistStory(input: StoryInput, storyId?: string) {
  const editor = await requireEditorAction();
  const existing = storyId
    ? (await db.select().from(stories).where(eq(stories.id, storyId)).limit(1))[0]
    : undefined;

  if (storyId && !existing) throw new Error("Story not found.");

  const roleDenial = storyMutationDenial(editor.role, editor.id, input.intent, existing);
  if (roleDenial) throw new Error(roleDenial);

  if (["approve", "schedule", "publish", "archive"].includes(input.intent)) {
    if (!seniorRoles.includes(editor.role)) throw new Error("An editor role is required for this workflow action.");
  }
  if (input.intent === "fact-check" && !factCheckRoles.includes(editor.role)) {
    throw new Error("A fact-check or editor role is required.");
  }
  if (existing && ["PUBLISHED", "UPDATED"].includes(existing.status) && !seniorRoles.includes(editor.role)) {
    throw new Error("Only editors can modify a live story.");
  }

  const slug = slugifyHeadline(input.slug || input.headline);
  if (!slug) throw new Error("The headline must produce a valid slug.");
  const urlPath = defaultStoryPath(input.contentType, slug);
  let status = desiredStatus(input.intent, existing);
  const isMeaningfulUpdate = existing ? meaningfulPublicChange(existing, input, slug) : false;

  if (input.intent === "save" && existing && ["PUBLISHED", "UPDATED"].includes(existing.status) && isMeaningfulUpdate) {
    status = "UPDATED";
  }

  const now = new Date();
  const scheduledFor = parseZonedDateTime(
    input.scheduledFor,
    input.scheduledTimezone,
    "Scheduled publication time",
  );
  const publishedAt = input.intent === "publish" ? existing?.publishedAt ?? now : existing?.publishedAt ?? null;
  const meaningfullyUpdatedAt = existing && isMeaningfulUpdate ? now : existing?.meaningfullyUpdatedAt ?? null;

  const savedId = await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.editor_profile_id', ${editor.id}, true)`);
    await tx.execute(sql`select set_config('app.revision_reason', ${`Newsroom ${input.intent}`}, true)`);
    await tx.execute(sql`select set_config('app.ai_assisted', 'false', true)`);

    const values = {
      headline: input.headline,
      slug,
      urlPath,
      subtitle: input.subtitle,
      summary: input.summary,
      body: textToArticleBlocks(input.bodyText),
      bodyText: input.bodyText,
      contentType: input.contentType,
      categoryId: input.categoryId,
      subcategory: input.subcategory,
      verificationStatus: input.verificationStatus,
      status,
      authorId: input.authorId,
      editorId: editor.id,
      primarySourceId: input.primarySourceId,
      originalSourcePublishedAt: parseUtcDateTime(input.originalSourcePublishedAt, "Original source date"),
      publishedAt,
      scheduledFor: status === "SCHEDULED" ? scheduledFor : null,
      scheduledTimezone: input.scheduledTimezone,
      meaningfullyUpdatedAt,
      lastReviewedAt: parseUtcDateTime(input.lastReviewedAt, "Last reviewed date"),
      heroImageAlt: input.heroImageAlt,
      heroImageCaption: input.heroImageCaption,
      heroImageCredit: input.heroImageCredit,
      heroMediaId: input.heroMediaId,
      featured: input.featured,
      breaking: input.breaking,
      evergreen: input.evergreen,
      trendingEligible: input.trendingEligible,
      tiktokUrl: input.tiktokUrl,
      youtubeUrl: input.youtubeUrl,
      instagramUrl: input.instagramUrl,
      facebookUrl: input.facebookUrl,
      canonicalOverride: input.canonicalOverride,
      seoTitleOverride: input.seoTitleOverride,
      metaDescriptionOverride: input.metaDescriptionOverride,
      openGraphTitleOverride: input.openGraphTitleOverride,
      openGraphDescriptionOverride: input.openGraphDescriptionOverride,
      openGraphImageId: input.openGraphImageId,
      robotsOverride: input.robotsOverride || null,
      internalNotes: input.internalNotes,
    };

    let id: string;
    if (existing) {
      await tx.update(stories).set(values).where(eq(stories.id, existing.id));
      id = existing.id;

      if (existing.urlPath !== urlPath) {
        await tx.insert(redirects).values({
          oldPath: existing.urlPath,
          newPath: urlPath,
          reason: "Editorial slug change",
          storyId: existing.id,
          createdBy: editor.id,
        });
      }
    } else {
      const [created] = await tx
        .insert(stories)
        .values({ ...values, createdBy: editor.id })
        .returning({ id: stories.id });
      id = created.id;
    }

    await tx.delete(storyTags).where(eq(storyTags.storyId, id));
    await tx.delete(storyRelations).where(eq(storyRelations.storyId, id));
    await tx.delete(storyVideos).where(eq(storyVideos.storyId, id));
    await tx.delete(storyEvergreenLinks).where(eq(storyEvergreenLinks.storyId, id));
    await tx.delete(storySources).where(eq(storySources.storyId, id));

    if (input.tagIds.length) await tx.insert(storyTags).values(input.tagIds.map((tagId) => ({ storyId: id, tagId })));
    const relatedStoryIds = input.relatedStoryIds.filter((relatedStoryId) => relatedStoryId !== id);
    if (relatedStoryIds.length) await tx.insert(storyRelations).values(relatedStoryIds.map((relatedStoryId, sortOrder) => ({ storyId: id, relatedStoryId, sortOrder })));
    if (input.relatedVideoIds.length) await tx.insert(storyVideos).values(input.relatedVideoIds.map((videoId, sortOrder) => ({ storyId: id, videoId, sortOrder })));
    if (input.evergreenPageIds.length) await tx.insert(storyEvergreenLinks).values(input.evergreenPageIds.map((evergreenPageId) => ({ storyId: id, evergreenPageId })));

    const sourceIds = [...new Set([...input.sourceIds, input.primarySourceId].filter((sourceId): sourceId is string => Boolean(sourceId)))];
    if (sourceIds.length) {
      await tx.insert(storySources).values(
        sourceIds.map((sourceId, sortOrder) => ({
          storyId: id,
          sourceId,
          isPrimary: sourceId === input.primarySourceId,
          sortOrder,
        })),
      );
    }

    return id;
  });

  revalidatePath("/admin");
  revalidatePath("/admin/stories");
  revalidatePath(urlPath);
  revalidatePath("/search");
  revalidatePath("/sitemap.xml");
  return savedId;
}

export async function createStory(formData: FormData) {
  const input = storyFormData(formData);
  const id = await persistStory(input);
  redirect(`/admin/stories/${id}?saved=1`);
}

export async function updateStory(formData: FormData) {
  const id = z.uuid().parse(formData.get("storyId"));
  await persistStory(storyFormData(formData), id);
  redirect(`/admin/stories/${id}?saved=1`);
}

const correctionSchema = z.object({
  originalIssue: z.string().trim().min(10).max(5_000),
  correction: z.string().trim().min(10).max(5_000),
  significance: z.enum(["MATERIAL", "NON_MATERIAL"]),
  isPublic: z.preprocess((value) => value === "on", z.boolean()),
});

export async function addCorrection(formData: FormData) {
  const id = z.uuid().parse(formData.get("storyId"));
  const editor = await requireEditorAction(factCheckRoles);
  const input = correctionSchema.parse(Object.fromEntries(formData.entries()));

  await db.insert(corrections).values({
    storyId: id,
    editorId: editor.id,
    originalIssue: input.originalIssue,
    correction: input.correction,
    significance: input.significance,
    isPublic: input.isPublic,
  });

  revalidatePath(`/admin/stories/${id}`);
  redirect(`/admin/stories/${id}?correction=1`);
}
