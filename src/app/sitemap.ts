import type { MetadataRoute } from "next";
import { listSitemapRecords } from "@/lib/cms/public-queries";
import { absoluteUrl, siteConfig } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteConfig.isIndexable) return [];
  const records = await listSitemapRecords();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/news"), changeFrequency: "hourly", priority: 0.9 },
    ...["/release-date", "/map", "/characters", "/characters/lucia", "/characters/jason", "/gameplay", "/trailers", "/vehicles", "/online", "/rumors"].map((path) => ({ url: absoluteUrl(path), changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: absoluteUrl("/verification"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/editorial-policy"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/corrections"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
  ];
  const storyRoutes: MetadataRoute.Sitemap = records.stories.filter((story) => story.robotsOverride !== "noindex,nofollow").map((story) => ({ url: absoluteUrl(story.path), lastModified: story.updatedAt ?? story.publishedAt ?? undefined, changeFrequency: "weekly", priority: 0.75 }));
  const evergreenRoutes: MetadataRoute.Sitemap = records.evergreen.filter((page) => page.robotsOverride !== "noindex,nofollow").map((page) => ({ url: absoluteUrl(page.path), lastModified: page.updatedAt ?? page.publishedAt ?? undefined, changeFrequency: "weekly", priority: 0.8 }));
  const authorRoutes: MetadataRoute.Sitemap = records.authors.map((author) => ({ url: absoluteUrl(`/authors/${author.slug}`), lastModified: author.updatedAt, changeFrequency: "monthly", priority: 0.5 }));

  return [...staticRoutes, ...storyRoutes, ...evergreenRoutes, ...authorRoutes];
}
