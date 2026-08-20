const fallbackUrl = "http://localhost:3000";

function resolveSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const candidate = configuredUrl ?? (vercelUrl ? `https://${vercelUrl}` : fallbackUrl);

  return candidate.startsWith("http") ? candidate : `https://${candidate}`;
}

export const siteConfig = {
  name: "GTA VI World",
  shortName: "GTAVIWORLDIO",
  description:
    "Independent GTA VI news, analysis, videos, rumors, and community intelligence with clear verification labels.",
  url: resolveSiteUrl(),
  author: "GTA VI World Editorial Desk",
  publisher: "GTA VI World",
  isIndexable:
    process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true" &&
    Boolean(process.env.NEXT_PUBLIC_SITE_URL),
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
