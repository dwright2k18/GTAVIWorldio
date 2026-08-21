import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { ArticleBody } from "@/components/article-body";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CmsEditorialImage } from "@/components/cms-editorial-image";
import { CmsStoryCard } from "@/components/cms-story-card";
import { ShareButton } from "@/components/share-button";
import { StoryArtwork } from "@/components/story-artwork";
import { VerificationBadge } from "@/components/verification-badge";
import { suggestHubLinks } from "@/lib/cms/internal-links";
import {
  canonicalUrl,
  deriveSeoTitle,
  suggestMetaDescription,
} from "@/lib/cms/seo";
import {
  getEditorialRedirect,
  getPublishedStoryBySlug,
} from "@/lib/cms/public-queries";
import { absoluteUrl, siteConfig } from "@/lib/site";
import type { VerificationStatus } from "@/lib/types";

type NewsStoryPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: NewsStoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = await getPublishedStoryBySlug(slug);
  if (!record) {
    return {
      title: "Page Not Found",
      alternates: { canonical: null },
      robots: { index: false, follow: false },
    };
  }

  const story = record.story;
  const title = deriveSeoTitle(story.headline, story.seoTitleOverride);
  const description = suggestMetaDescription(
    story.summary,
    story.metaDescriptionOverride,
  );
  const canIndex =
    siteConfig.isIndexable && story.robotsOverride !== "noindex,nofollow";
  const url = canonicalUrl(story.urlPath, story.canonicalOverride);
  const image = record.heroMedia?.url ?? absoluteUrl("/api/og");

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: canIndex, follow: canIndex },
    openGraph: {
      type: "article",
      url,
      title: story.openGraphTitleOverride ?? title,
      description: story.openGraphDescriptionOverride ?? description,
      images: [image],
      publishedTime: story.publishedAt?.toISOString(),
      modifiedTime: (
        story.meaningfullyUpdatedAt ?? story.publishedAt
      )?.toISOString(),
      authors: record.author ? [record.author.name] : undefined,
      section: record.category?.name,
      tags: record.tags.map((tag) => tag.name),
    },
    twitter: {
      card: "summary_large_image",
      title: story.openGraphTitleOverride ?? title,
      description: story.openGraphDescriptionOverride ?? description,
      images: [image],
    },
  };
}

export default async function NewsStoryPage({ params }: NewsStoryPageProps) {
  const { slug } = await params;
  const record = await getPublishedStoryBySlug(slug);

  if (!record) {
    const historical = await getEditorialRedirect(`/news/${slug}`);
    if (historical) permanentRedirect(historical.newPath);
    notFound();
  }

  const { story } = record;
  const storyUrl = canonicalUrl(story.urlPath, story.canonicalOverride);
  const verification = story.verificationStatus.replaceAll(
    "_",
    " ",
  ) as VerificationStatus;
  const suggestedHubs = suggestHubLinks(
    `${story.headline} ${story.summary} ${story.bodyText}`,
  );
  const authorType = record.author?.name.endsWith("Staff")
    ? "Organization"
    : "Person";
  const hasApprovedHero = Boolean(
    record.heroMedia?.altText &&
      record.heroMedia.width &&
      record.heroMedia.height,
  );

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": story.contentType === "NEWS" ? "NewsArticle" : "Article",
    headline: story.headline,
    description: story.summary,
    datePublished: story.publishedAt?.toISOString(),
    dateModified: (
      story.meaningfullyUpdatedAt ?? story.publishedAt
    )?.toISOString(),
    mainEntityOfPage: storyUrl,
    url: storyUrl,
    image: record.heroMedia?.url ?? absoluteUrl("/api/og"),
    articleSection: record.category?.name,
    keywords: record.tags.map((tag) => tag.name).join(", "),
    isAccessibleForFree: true,
    author: record.author
      ? {
          "@type": authorType,
          name: record.author.name,
          url: absoluteUrl(`/authors/${record.author.slug}`),
        }
      : undefined,
    publisher: {
      "@type": "Organization",
      name: siteConfig.publisher,
      url: siteConfig.url,
    },
    about: { "@type": "VideoGame", name: "Grand Theft Auto VI" },
    citation: record.sources.map(({ source }) => source.url),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "News",
        item: absoluteUrl("/news"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: story.headline,
        item: storyUrl,
      },
    ],
  };

  return (
    <article className="min-h-screen pb-20 pt-8">
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
      <div className="site-shell">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "News", href: "/news" },
            { label: story.headline },
          ]}
        />

        <header className="mx-auto mt-9 max-w-5xl text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <VerificationBadge status={verification} />
            <span className="text-xs font-black uppercase tracking-[0.16em] text-pink-300">
              {record.category?.name ?? story.contentType}
            </span>
          </div>
          <h1 className="mt-6 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            {story.headline}
          </h1>
          {story.subtitle ? (
            <p className="mx-auto mt-5 max-w-3xl text-xl text-zinc-300">
              {story.subtitle}
            </p>
          ) : null}
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
            {story.summary}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-4 text-sm text-zinc-500">
            <span>By {record.author?.name ?? siteConfig.author}</span>
            {story.publishedAt ? (
              <span>
                Published{" "}
                <time dateTime={story.publishedAt.toISOString()}>
                  {story.publishedAt.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </span>
            ) : null}
            {story.meaningfullyUpdatedAt ? (
              <span>
                Updated{" "}
                <time dateTime={story.meaningfullyUpdatedAt.toISOString()}>
                  {story.meaningfullyUpdatedAt.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </span>
            ) : null}
          </div>
        </header>

        <div className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[2rem] border border-white/12">
          {hasApprovedHero && record.heroMedia ? (
            <CmsEditorialImage media={record.heroMedia} priority />
          ) : (
            <StoryArtwork
              aspect="wide"
              media={{
                alt:
                  story.heroImageAlt ?? "GTAVIWorldio editorial story artwork",
                label: record.category?.name ?? "GTAVIWorldio",
                gradient: "from-[#13224b] via-[#5a174f] to-[#082f3b]",
                accent: "#67e8f9",
              }}
              priority
            />
          )}
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-9 lg:grid-cols-[8rem_minmax(0,1fr)]">
          <aside>
            <ShareButton path={story.urlPath} title={story.headline} />
          </aside>
          <div>
            <ArticleBody blocks={story.body} />

            {record.sources.length ? (
              <section className="mt-12 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.045] p-6">
                <h2 className="text-2xl font-black">Sources</h2>
                <ul className="mt-4 space-y-4">
                  {record.sources.map(({ source, evidenceNotes }) => (
                    <li key={source.id}>
                      <a
                        className="font-bold text-cyan-200 underline"
                        href={source.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {source.name}
                      </a>
                      {evidenceNotes ? (
                        <p className="mt-1 text-sm text-zinc-400">
                          {evidenceNotes}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {record.corrections.length ? (
              <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.05] p-6">
                <h2 className="text-2xl font-black">Corrections</h2>
                {record.corrections.map((correction) => (
                  <p
                    className="mt-3 text-sm leading-6 text-zinc-300"
                    key={correction.id}
                  >
                    <time dateTime={correction.correctedAt.toISOString()}>
                      {correction.correctedAt.toLocaleDateString("en-US")}
                    </time>
                    : {correction.correction}
                  </p>
                ))}
              </section>
            ) : null}
          </div>
        </div>

        {suggestedHubs.length || record.evergreenLinks.length ? (
          <section className="mt-16 border-t border-white/10 pt-12">
            <h2 className="text-3xl font-black">Explore the topic</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {[
                ...record.evergreenLinks.map((link) => ({
                  label: link.title,
                  href: link.path,
                })),
                ...suggestedHubs,
              ]
                .filter(
                  (link, index, links) =>
                    links.findIndex(
                      (candidate) => candidate.href === link.href,
                    ) === index,
                )
                .slice(0, 5)
                .map((link) => (
                  <Link
                    className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 font-bold hover:border-cyan-300"
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                ))}
            </div>
          </section>
        ) : null}

        {record.relatedStories.length ? (
          <section className="mt-16 border-t border-white/10 pt-12">
            <h2 className="text-3xl font-black">Related stories</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {record.relatedStories.map((related) => (
                <CmsStoryCard
                  key={related.id}
                  story={{ ...related, urlPath: `/news/${related.slug}` }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {record.relatedVideos.length ? (
          <section className="mt-16 border-t border-white/10 pt-12">
            <h2 className="text-3xl font-black">Related videos</h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {record.relatedVideos.map((video) => (
                <li
                  className="rounded-2xl border border-white/10 p-5"
                  key={video.id}
                >
                  <p className="font-bold">{video.title}</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {video.kind.replaceAll("_", " ")} ·{" "}
                    {video.durationSeconds ?? "Duration pending"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
