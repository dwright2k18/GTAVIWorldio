import { z } from "zod";

import { validateCanonicalOverride } from "./seo";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.url().nullable(),
);

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.uuid().nullable(),
);

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export const storyInputSchema = z
  .object({
    headline: z.string().trim().min(8).max(180),
    slug: z.string().trim().max(90).optional().default(""),
    subtitle: optionalText,
    summary: z.string().trim().min(40).max(500),
    bodyText: z.string().trim().max(100_000),
    contentType: z.enum(["NEWS", "FEATURE", "ANALYSIS", "GUIDE", "EVERGREEN", "VIDEO"]),
    categoryId: optionalUuid,
    subcategory: optionalText,
    verificationStatus: z.enum(["CONFIRMED", "CREDIBLE_REPORT", "RUMOR", "SPECULATION", "ALLEGED_LEAK"]),
    authorId: optionalUuid,
    primarySourceId: optionalUuid,
    sourceIds: z.array(z.uuid()).default([]),
    originalSourcePublishedAt: optionalText,
    scheduledFor: optionalText,
    scheduledTimezone: z.string().trim().min(1).max(80).default("UTC"),
    lastReviewedAt: optionalText,
    heroImageAlt: optionalText,
    heroImageCaption: optionalText,
    heroImageCredit: optionalText,
    heroMediaId: optionalUuid,
    openGraphImageId: optionalUuid,
    featured: checkbox,
    breaking: checkbox,
    evergreen: checkbox,
    trendingEligible: checkbox,
    tiktokUrl: optionalUrl,
    youtubeUrl: optionalUrl,
    instagramUrl: optionalUrl,
    facebookUrl: optionalUrl,
    canonicalOverride: optionalText,
    seoTitleOverride: optionalText,
    metaDescriptionOverride: optionalText,
    openGraphTitleOverride: optionalText,
    openGraphDescriptionOverride: optionalText,
    robotsOverride: z.enum(["", "index,follow", "noindex,nofollow"]).default(""),
    internalNotes: optionalText,
    tagIds: z.array(z.uuid()).default([]),
    relatedStoryIds: z.array(z.uuid()).default([]),
    relatedVideoIds: z.array(z.uuid()).default([]),
    evergreenPageIds: z.array(z.uuid()).default([]),
    intent: z.enum(["save", "review", "fact-check", "approve", "schedule", "publish", "archive"]),
  })
  .superRefine((value, context) => {
    const canonicalError = validateCanonicalOverride(value.canonicalOverride);
    if (canonicalError) {
      context.addIssue({ code: "custom", path: ["canonicalOverride"], message: canonicalError });
    }

    if (value.intent === "schedule" && !value.scheduledFor) {
      context.addIssue({ code: "custom", path: ["scheduledFor"], message: "A scheduled time is required." });
    }

    if (value.intent === "publish") {
      if (!value.authorId) context.addIssue({ code: "custom", path: ["authorId"], message: "Author is required to publish." });
      if (!value.primarySourceId) context.addIssue({ code: "custom", path: ["primarySourceId"], message: "Primary source is required to publish." });
      if (value.bodyText.length < 200) context.addIssue({ code: "custom", path: ["bodyText"], message: "A substantive article body is required to publish." });
    }
  });

export type StoryInput = z.infer<typeof storyInputSchema>;

export function storyFormData(formData: FormData) {
  return storyInputSchema.parse({
    ...Object.fromEntries(formData.entries()),
    tagIds: formData.getAll("tagIds"),
    sourceIds: formData.getAll("sourceIds"),
    relatedStoryIds: formData.getAll("relatedStoryIds"),
    relatedVideoIds: formData.getAll("relatedVideoIds"),
    evergreenPageIds: formData.getAll("evergreenPageIds"),
  });
}
