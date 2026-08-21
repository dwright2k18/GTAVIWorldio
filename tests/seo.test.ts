import { describe, expect, it } from "vitest";

import {
  defaultStoryPath,
  deriveSeoTitle,
  normalizePath,
  slugifyHeadline,
  suggestMetaDescription,
  validateCanonicalOverride,
} from "@/lib/cms/seo";

describe("CMS SEO defaults", () => {
  it("creates short, stable, lowercase slugs", () => {
    expect(slugifyHeadline("Everything Rockstar Has Confirmed About GTA VI"))
      .toBe("everything-rockstar-has-confirmed-about-gta-vi");
  });

  it("uses the site suffix only when meaning remains readable", () => {
    expect(deriveSeoTitle("GTA VI News")).toBe("GTA VI News | GTAVIWORLDIO");
    expect(deriveSeoTitle("A".repeat(70))).toBe("A".repeat(70));
  });

  it("suggests descriptions without breaking words when practical", () => {
    const result = suggestMetaDescription("word ".repeat(50));
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
  });

  it("never accepts preview or localhost canonical overrides", () => {
    expect(validateCanonicalOverride("https://example.vercel.app/news/a")).toBeTruthy();
    expect(validateCanonicalOverride("http://localhost:3000/news/a")).toBeTruthy();
    expect(validateCanonicalOverride("https://gtaviworld.io/news/a")).toBeNull();
  });

  it("normalizes paths and keeps article URLs descriptive", () => {
    expect(normalizePath("News//Release-Update/")).toBe("/news/release-update");
    expect(defaultStoryPath("NEWS", "release-update")).toBe("/news/release-update");
    expect(defaultStoryPath("GUIDE", "release-date")).toBe("/guides/release-date");
  });
});
