import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import { BreakingNewsBar } from "@/components/breaking-news-bar";
import { QuickHitCard } from "@/components/quick-hit-card";
import { SectionHeading } from "@/components/section-heading";
import { StoryArtwork } from "@/components/story-artwork";
import { StoryCard } from "@/components/story-card";
import { TrendingList } from "@/components/trending-list";
import { VerificationBadge } from "@/components/verification-badge";
import {
  heroStory,
  quickHits,
  stories,
  verificationDetails,
} from "@/data/content";
import { formatEditorialDate } from "@/lib/format";
import { verificationStatuses } from "@/lib/types";

export default function Home() {
  const latestStories = stories.slice(1, 5);
  const trendingStories = [...stories]
    .sort((a, b) => b.metrics.trendingScore - a.metrics.trendingScore)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#090813] text-white">
      <BreakingNewsBar />

      <section className="relative isolate overflow-hidden py-10 sm:py-14 lg:py-18">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(244,114,182,0.17),transparent_30%),radial-gradient(circle_at_88%_38%,rgba(103,232,249,0.13),transparent_32%)]" />
        <div className="site-shell grid items-center gap-8 lg:grid-cols-[1.02fr_.98fr] lg:gap-12">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="eyebrow">Lead story</span>
              <VerificationBadge status={heroStory.verification} />
              <span className="rounded-full border border-white/10 px-2.5 py-1.5 text-[0.62rem] font-black tracking-widest text-zinc-400 uppercase">
                Sample editorial
              </span>
            </div>
            <h1 className="mt-6 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              {heroStory.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
              {heroStory.summary}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-zinc-500 sm:text-sm">
              <span className="font-bold text-pink-300">{heroStory.category}</span>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4" />
                {formatEditorialDate(heroStory.datePublished)}
              </span>
              <span>{heroStory.readingMinutes} min read</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/stories/${heroStory.slug}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#090813] transition-transform hover:-translate-y-0.5"
              >
                Read story
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/latest"
                className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white hover:border-cyan-300/40"
              >
                Browse latest
              </Link>
            </div>
          </div>
          <Link href={`/stories/${heroStory.slug}`} className="block overflow-hidden rounded-[2rem] border border-white/12 shadow-2xl shadow-pink-950/20">
            <StoryArtwork media={heroStory.heroMedia} aspect="wide" priorityLabel="GTA VI WORLD ORIGINAL" />
          </Link>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#0c0b13] py-16 sm:py-20">
        <div className="site-shell">
          <SectionHeading
            eyebrow="The newsroom"
            title="Latest GTA VI news"
            description="Development stories demonstrate the final editorial system without presenting invented announcements as current news."
            link={{ label: "All latest", href: "/latest" }}
          />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-5 sm:grid-cols-2">
              {latestStories.map((story) => (
                <StoryCard key={story.storyId} story={story} />
              ))}
            </div>
            <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
              <p className="eyebrow">Trending now</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">Reader radar</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Sample ranking data, ready to connect to analytics later.
              </p>
              <div className="mt-6">
                <TrendingList stories={trendingStories} />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="site-shell">
          <SectionHeading
            eyebrow="13-second intelligence"
            title="GTA VI Quick Hits"
            description="A vertical, mobile-first preview of the short-form pipeline. Sample clips are static and never autoplay."
            link={{ label: "Open Quick Hits", href: "/quick-hits" }}
          />
          <div className="grid grid-flow-col auto-cols-[78%] gap-4 overflow-x-auto pb-4 sm:auto-cols-[45%] lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible">
            {quickHits.slice(0, 3).map((video) => (
              <QuickHitCard key={video.videoId} video={video} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-[radial-gradient(circle_at_20%_50%,rgba(103,232,249,0.08),transparent_30%),radial-gradient(circle_at_80%_50%,rgba(244,114,182,0.09),transparent_30%)] py-16 sm:py-20">
        <div className="site-shell">
          <SectionHeading
            eyebrow="Trust layer"
            title="Know what is verified"
            description="Every story and short-form video carries the same status language across the site and future social channels."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {verificationStatuses.map((status) => (
              <article key={status} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <VerificationBadge status={status} />
                <h3 className="mt-5 text-sm font-black text-white">
                  {verificationDetails[status].short}
                </h3>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {verificationDetails[status].description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
