import { absoluteUrl, siteConfig } from "@/lib/site";

const previewHostPattern = /(^localhost$|\.vercel\.app$)/i;

export function slugifyHeadline(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function normalizePath(value: string) {
  const path = value.trim().toLowerCase().replace(/\/{2,}/g, "/");
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/$/, "")
    : withLeadingSlash;
}

export function defaultStoryPath(contentType: string, slug: string) {
  const prefix = contentType === "GUIDE" ? "/guides" : "/news";
  return normalizePath(`${prefix}/${slug}`);
}

export function deriveSeoTitle(headline: string, override?: string | null) {
  const manual = override?.trim();
  if (manual) return manual;

  const suffix = ` | ${siteConfig.shortName}`;
  return headline.length + suffix.length <= 65 ? `${headline}${suffix}` : headline;
}

export function suggestMetaDescription(
  summary: string,
  override?: string | null,
) {
  const manual = override?.trim();
  if (manual) return manual;

  const normalized = summary.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) return normalized;

  const candidate = normalized.slice(0, 157);
  const lastSpace = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastSpace > 120 ? lastSpace : 157).trimEnd()}…`;
}

export function canonicalUrl(path: string, override?: string | null) {
  if (override?.trim()) return override.trim();
  return absoluteUrl(normalizePath(path));
}

export function validateCanonicalOverride(value?: string | null) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || previewHostPattern.test(url.hostname)) {
      return "Canonical overrides must use HTTPS and cannot target localhost or Vercel preview domains.";
    }
    return null;
  } catch {
    return "Canonical override must be a valid absolute URL.";
  }
}

export type SeoWarning = {
  field: string;
  severity: "high" | "medium" | "low";
  message: string;
};

export function evaluateStorySeo(input: {
  headline: string;
  summary: string;
  urlPath: string;
  seoTitleOverride?: string | null;
  metaDescriptionOverride?: string | null;
  canonicalOverride?: string | null;
  heroImageAlt?: string | null;
  authorId?: string | null;
  primarySourceId?: string | null;
  verificationStatus?: string | null;
  bodyText?: string | null;
  relatedCount?: number;
}) {
  const title = deriveSeoTitle(input.headline, input.seoTitleOverride);
  const description = suggestMetaDescription(
    input.summary,
    input.metaDescriptionOverride,
  );
  const warnings: SeoWarning[] = [];

  if (!title) warnings.push({ field: "title", severity: "high", message: "Missing SEO title." });
  if (title.length > 65) warnings.push({ field: "title", severity: "medium", message: `SEO title is ${title.length} characters.` });
  if (description.length < 120) warnings.push({ field: "description", severity: "low", message: `Meta description is only ${description.length} characters.` });
  if (description.length > 165) warnings.push({ field: "description", severity: "medium", message: `Meta description is ${description.length} characters.` });
  if (!input.urlPath) warnings.push({ field: "canonical", severity: "high", message: "Missing canonical path." });
  if (!input.heroImageAlt) warnings.push({ field: "image", severity: "medium", message: "Hero image alt text is missing." });
  if (!input.authorId) warnings.push({ field: "author", severity: "high", message: "Author is missing." });
  if (!input.primarySourceId) warnings.push({ field: "source", severity: "high", message: "Primary source is missing." });
  if (!input.verificationStatus) warnings.push({ field: "verification", severity: "high", message: "Verification status is missing." });
  if ((input.bodyText?.trim().length ?? 0) < 400) warnings.push({ field: "body", severity: "medium", message: "Article may be too thin for publication." });
  if ((input.relatedCount ?? 0) === 0) warnings.push({ field: "links", severity: "low", message: "No internal relationships are configured." });

  const canonicalError = validateCanonicalOverride(input.canonicalOverride);
  if (canonicalError) warnings.push({ field: "canonical", severity: "high", message: canonicalError });

  return { title, description, canonical: canonicalUrl(input.urlPath, input.canonicalOverride), warnings };
}
