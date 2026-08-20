import type { MetadataRoute } from "next";
import { stories } from "@/data/content";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/latest"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/quick-hits"), changeFrequency: "daily", priority: 0.8 },
  ];
  const storyRoutes: MetadataRoute.Sitemap = stories.map((story) => ({
    url: absoluteUrl(`/stories/${story.slug}`),
    lastModified: story.dateUpdated,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [...staticRoutes, ...storyRoutes];
}
