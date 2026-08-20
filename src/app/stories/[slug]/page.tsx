import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import { QuickHitCard } from "@/components/quick-hit-card";
import { ShareButton } from "@/components/share-button";
import { StoryArtwork } from "@/components/story-artwork";
import { StoryCard } from "@/components/story-card";
import { VerificationBadge } from "@/components/verification-badge";
import {
  getRelatedQuickHits,
  getRelatedStories,
  getStoryBySlug,
  stories,
  verificationDetails,
} from "@/data/content";
import { formatEditorialDate } from "@/lib/format";
import { absoluteUrl, siteConfig } from "@/lib/site";
import type { ArticleBlock } from "@/lib/types";

export function generateStaticParams() {
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const story = getStoryBySlug(slug);

  if (!story) return {};

  const path = `/stories/${story.slug}`;

  return {
    title: story.headline,
    description: story.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      title: story.headline,
      description: story.summary,
      publishedTime: story.datePublished,
      modifiedTime: story.dateUpdated,
      authors: [story.author],
      section: story.category,
      tags: story.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: story.headline,
      description: story.summary,
    },
  };
}

function ArticleContent({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="article-copy">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "heading") return <h2 key={key}>{block.content}</h2>;
        if (block.type === "quote") return <blockquote key={key}>{block.content}</blockquote>;
        if (block.type === "list") {
          return (
            <ul key={key}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={key}>{block.content}</p>;
      })}
    </div>
  );
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = getStoryBySlug(slug);

  if (!story) notFound();

  const relatedStories = getRelatedStories(story);
  const relatedQuickHits = getRelatedQuickHits(story);
  const latestNews = stories
    .filter((candidate) => candidate.storyId !== story.storyId)
    .sort(
      (a, b) =>
        new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime(),
    )
    .slice(0, 4);
  const trendingNews = [...stories]
    .filter((candidate) => candidate.storyId !== story.storyId)
    .sort((a, b) => b.metrics.trendingScore - a.metrics.trendingScore)
    .slice(0, 4);
  const sourceUrl = story.source.url.startsWith("http")
    ? story.source.url
    : absoluteUrl(story.source.url);
  const articleUrl = absoluteUrl(`/stories/${story.slug}`);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.headline,
    description: story.summary,
    datePublished: story.datePublished,
    dateModified: story.dateUpdated,
    mainEntityOfPage: articleUrl,
    url: articleUrl,
    image: absoluteUrl("/opengraph-image"),
    articleSection: story.category,
    keywords: story.tags.join(", "),
    isAccessibleForFree: true,
    author: { "@type": "Organization", name: story.author },
    publisher: { "@type": "Organization", name: siteConfig.publisher, url: siteConfig.url },
    about: { "@type": "VideoGame", name: "Grand Theft Auto VI" },
    citation: sourceUrl,
  };
  const breadcrumbJsonLd = {
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
        name: "Latest",
        item: absoluteUrl("/latest"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: story.headline,
        item: articleUrl,
      },
    ],
  };

  return (
    <article className="min-h-screen pb-18 pt-8 sm:pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="site-shell">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Latest", href: "/latest" },
            { label: story.headline },
          ]}
        />

        <header className="mx-auto mt-9 max-w-5xl text-center">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <VerificationBadge status={story.verification} />
            <span className="text-[0.7rem] font-black tracking-[0.16em] text-pink-300 uppercase">
              {story.category}
            </span>
          </div>
          <h1 className="mt-6 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            {story.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-zinc-300 sm:text-xl sm:leading-8">
            {story.summary}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500 sm:text-sm">
            <span className="font-bold text-zinc-300">By {story.author}</span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" />
              Published <time dateTime={story.datePublished}>{formatEditorialDate(story.datePublished)}</time>
            </span>
            <span>Updated <time dateTime={story.dateUpdated}>{formatEditorialDate(story.dateUpdated)}</time></span>
            <span>{story.readingMinutes} min read</span>
          </div>
        </header>

        <div className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[2rem] border border-white/12">
          <StoryArtwork media={story.heroMedia} aspect="wide" priority priorityLabel="GTA VI WORLD ORIGINAL" />
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-9 lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-12">
          <aside className="lg:sticky lg:top-25 lg:self-start" aria-label="Share this article">
            <p className="mb-3 text-[0.62rem] font-black tracking-[0.16em] text-zinc-600 uppercase">Share</p>
            <ShareButton title={story.headline} path={`/stories/${story.slug}`} />
          </aside>
          <div>
            <aside className="mb-9 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-wrap items-center gap-3">
                <VerificationBadge status={story.verification} />
                <strong className="text-sm text-white">{verificationDetails[story.verification].short}</strong>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {verificationDetails[story.verification].description}
              </p>
            </aside>

            <ArticleContent blocks={story.article} />

            <section className="mt-12 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.045] p-6 sm:p-8" aria-labelledby="sources-heading">
              <p className="eyebrow">Trace the evidence</p>
              <h2 id="sources-heading" className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">
                Sources
              </h2>
              <a
                href={story.source.url}
                className="mt-5 inline-flex font-bold text-cyan-200 underline decoration-cyan-300/35 underline-offset-4 hover:text-white"
                {...(story.source.url.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {story.source.name}
              </a>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{story.source.note}</p>
            </section>
          </div>
        </div>

        {relatedStories.length > 0 && (
          <section className="mt-18 border-t border-white/8 pt-14" aria-labelledby="related-stories-heading">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="eyebrow">Continue reading</p>
                <h2 id="related-stories-heading" className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">
                  Related stories
                </h2>
              </div>
              <Link href="/latest" className="text-sm font-bold text-zinc-400 hover:text-white">
                View all
              </Link>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedStories.map((related) => (
                <StoryCard key={related.storyId} story={related} />
              ))}
            </div>
          </section>
        )}

        {relatedQuickHits.length > 0 && (
          <section className="mt-16 border-t border-white/8 pt-14" aria-labelledby="related-videos-heading">
            <p className="eyebrow">Watch next</p>
            <h2 id="related-videos-heading" className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">
              Related Videos
            </h2>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedQuickHits.map((video) => (
                <QuickHitCard key={video.videoId} video={video} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-16 border-t border-white/8 pt-14" aria-labelledby="more-news-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Keep exploring</p>
              <h2 id="more-news-heading" className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">
                More from GTA VI World
              </h2>
            </div>
            <Link href="/latest" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
              All latest news
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {[
              { title: "Latest News", stories: latestNews },
              { title: "Trending Stories", stories: trendingNews },
            ].map((group) => (
              <section key={group.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                <h3 className="text-lg font-black text-white">{group.title}</h3>
                <ol className="mt-4 divide-y divide-white/8">
                  {group.stories.map((item, index) => (
                    <li key={item.storyId} className="grid grid-cols-[2rem_1fr] gap-3 py-4 first:pt-0 last:pb-0">
                      <span className="text-lg font-black text-white/20">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <VerificationBadge status={item.verification} compact />
                        <Link
                          href={`/stories/${item.slug}`}
                          className="mt-2 block text-sm font-bold leading-5 text-zinc-200 hover:text-pink-200 sm:text-base sm:leading-6"
                        >
                          {item.headline}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
