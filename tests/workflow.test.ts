import { describe, expect, it } from "vitest";

import { storyInputSchema } from "@/lib/cms/validation";

const base = {
  headline: "A sourced GTA VI newsroom test story",
  slug: "",
  subtitle: null,
  summary: "A sufficiently detailed summary that explains the relevant newsroom test story.",
  bodyText: "A substantive body ".repeat(20),
  contentType: "NEWS",
  categoryId: null,
  subcategory: null,
  verificationStatus: "CONFIRMED",
  authorId: null,
  primarySourceId: null,
  sourceIds: [],
  originalSourcePublishedAt: null,
  scheduledFor: null,
  scheduledTimezone: "UTC",
  lastReviewedAt: null,
  heroImageAlt: null,
  heroImageCaption: null,
  heroImageCredit: null,
  heroMediaId: null,
  openGraphImageId: null,
  featured: false,
  breaking: false,
  evergreen: false,
  trendingEligible: false,
  tiktokUrl: null,
  youtubeUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  canonicalOverride: null,
  seoTitleOverride: null,
  metaDescriptionOverride: null,
  openGraphTitleOverride: null,
  openGraphDescriptionOverride: null,
  robotsOverride: "",
  internalNotes: null,
  tagIds: [],
  relatedStoryIds: [],
  relatedVideoIds: [],
  evergreenPageIds: [],
} as const;

describe("editorial workflow validation", () => {
  it("allows an incomplete record to remain a draft", () => {
    expect(storyInputSchema.safeParse({ ...base, intent: "save" }).success).toBe(true);
  });

  it("blocks publication without an approved author and source", () => {
    const result = storyInputSchema.safeParse({ ...base, intent: "publish" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["authorId", "primarySourceId"]),
      );
    }
  });

  it("requires an actual scheduled time", () => {
    expect(storyInputSchema.safeParse({ ...base, intent: "schedule" }).success).toBe(false);
  });
});
