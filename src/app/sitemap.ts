import type { MetadataRoute } from "next";
import { stories } from "@/data/content";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/latest"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/quick-hits"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/verification"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/editorial-policy"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/corrections"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
  ];
  const storyRoutes: MetadataRoute.Sitemap = stories.map((story) => ({
    url: absoluteUrl(`/stories/${story.slug}`),
    lastModified: story.dateUpdated,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [...staticRoutes, ...storyRoutes];
}
