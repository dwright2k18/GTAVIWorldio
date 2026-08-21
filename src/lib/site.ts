const fallbackUrl = "http://localhost:3000";

function enabled(value: string | undefined) {
  return value === "true";
}

function resolvePublicEmail() {
  const candidate = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)
    ? candidate
    : null;
}

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
  contactEmail: resolvePublicEmail(),
  isIndexable:
    enabled(process.env.NEXT_PUBLIC_SITE_INDEXABLE) &&
    Boolean(process.env.NEXT_PUBLIC_SITE_URL),
};

/**
 * Pre-launch editorial gates. These remain off until the corresponding live
 * data or approved media is connected and an editor explicitly enables them.
 */
export const siteFeatures = {
  breaking: enabled(process.env.NEXT_PUBLIC_BREAKING_ENABLED),
  audienceRankings: enabled(
    process.env.NEXT_PUBLIC_AUDIENCE_RANKINGS_ENABLED,
  ),
  quickHits: enabled(process.env.NEXT_PUBLIC_QUICK_HITS_ENABLED),
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
