"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { evergreenPages, evergreenSources, redirects } from "@/db/schema";
import { requireEditorAction } from "@/lib/auth/dal";
import { textToArticleBlocks } from "@/lib/cms/content";
import { normalizePath, slugifyHeadline, validateCanonicalOverride } from "@/lib/cms/seo";

const nullable = z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : null, z.string().nullable());
const nullableUuid = z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : null, z.uuid().nullable());
const schema = z.object({
  path: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(90).optional(),
  title: z.string().trim().min(6).max(180),
  searchIntent: z.string().trim().min(30).max(500),
  summary: z.string().trim().min(40).max(500),
  bodyText: z.string().trim().max(100_000),
  confirmedText: z.string().trim().max(50_000),
  developmentsText: z.string().trim().max(50_000),
  faqJson: z.string().trim().max(50_000).default("[]"),
  authorId: nullableUuid,
  seoTitleOverride: nullable,
  metaDescriptionOverride: nullable,
  canonicalOverride: nullable,
  robotsOverride: z.enum(["", "index,follow", "noindex,nofollow"]),
  sourceIds: z.array(z.uuid()),
  intent: z.enum(["save", "review", "publish", "archive"]),
});

export async function saveEvergreen(pageId: string, formData: FormData) {
  const editor = await requireEditorAction(["OWNER", "ADMIN", "EDITOR"]);
  const id = z.uuid().parse(pageId);
  const parsed = schema.parse({ ...Object.fromEntries(formData.entries()), sourceIds: formData.getAll("sourceIds") });
  const canonicalError = validateCanonicalOverride(parsed.canonicalOverride);
  if (canonicalError) throw new Error(canonicalError);
  const faq = z.array(z.object({ question: z.string().trim().min(5), answer: z.string().trim().min(10) })).parse(JSON.parse(parsed.faqJson || "[]"));
  const [current] = await db.select().from(evergreenPages).where(eq(evergreenPages.id, id)).limit(1);
  if (!current) throw new Error("Evergreen page not found.");
  if (parsed.intent === "publish" && (!parsed.authorId || !parsed.sourceIds.length || parsed.bodyText.length < 200)) throw new Error("Published evergreen pages require author, source, and substantive body.");
  const status = parsed.intent === "review" ? "NEEDS_REVIEW" : parsed.intent === "publish" ? "PUBLISHED" : parsed.intent === "archive" ? "ARCHIVED" : current.status;
  const path = normalizePath(parsed.path);
  const meaningfulChange = current.title !== parsed.title || current.summary !== parsed.summary || JSON.stringify(current.body) !== JSON.stringify(textToArticleBlocks(parsed.bodyText));

  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.editor_profile_id', ${editor.id}, true)`);
    await tx.execute(sql`select set_config('app.revision_reason', ${`Evergreen ${parsed.intent}`}, true)`);
    await tx.update(evergreenPages).set({ path, slug: slugifyHeadline(parsed.slug || parsed.title), title: parsed.title, searchIntent: parsed.searchIntent, summary: parsed.summary, body: textToArticleBlocks(parsed.bodyText), officiallyConfirmed: textToArticleBlocks(parsed.confirmedText), recentDevelopments: textToArticleBlocks(parsed.developmentsText), faq, status, authorId: parsed.authorId, seoTitleOverride: parsed.seoTitleOverride, metaDescriptionOverride: parsed.metaDescriptionOverride, canonicalOverride: parsed.canonicalOverride, robotsOverride: parsed.robotsOverride || null, publishedAt: parsed.intent === "publish" ? current.publishedAt ?? new Date() : current.publishedAt, meaningfullyUpdatedAt: meaningfulChange ? new Date() : current.meaningfullyUpdatedAt, lastReviewedAt: parsed.intent === "review" || parsed.intent === "publish" ? new Date() : current.lastReviewedAt }).where(eq(evergreenPages.id, id));
    if (current.path !== path) await tx.insert(redirects).values({ oldPath: current.path, newPath: path, reason: "Evergreen path change", createdBy: editor.id });
    await tx.delete(evergreenSources).where(eq(evergreenSources.evergreenPageId, id));
    if (parsed.sourceIds.length) await tx.insert(evergreenSources).values(parsed.sourceIds.map((sourceId, sortOrder) => ({ evergreenPageId: id, sourceId, sortOrder })));
  });
  revalidatePath("/admin/evergreen");
  revalidatePath(path);
  revalidatePath("/sitemap.xml");
}
