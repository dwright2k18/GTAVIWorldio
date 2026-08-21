import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import { BreakingNewsBar } from "@/components/breaking-news-bar";
import { NewsletterSignup } from "@/components/newsletter-signup";
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
import { siteFeatures } from "@/lib/site";
import { verificationStatuses } from "@/lib/types";

export default function Home() {
  const latestStories = stories.slice(1, 5);
  const trendingStories = siteFeatures.audienceRankings
    ? [...stories]
        .sort((a, b) => b.metrics.trendingScore - a.metrics.trendingScore)
        .slice(0, 5)
    : [];
  const mostPopularStories = siteFeatures.audienceRankings
    ? [...stories].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, 3)
    : [];
  const liveQuickHits = siteFeatures.quickHits
    ? quickHits.filter((video) => Boolean(video.video))
    : [];
  const todayLinks = [
    ...(siteFeatures.breaking ? [["Breaking", "#breaking"]] : []),
    ["Latest", "#latest"],
    ...(siteFeatures.audienceRankings
      ? [
          ["Trending", "#trending"],
          ["Most Popular", "#popular"],
        ]
      : []),
    ...(liveQuickHits.length > 0 ? [["Quick Hits", "#quick-hits"]] : []),
  ];

  return (
    <div className="min-h-screen bg-[#090813] text-white">
      {siteFeatures.breaking && <BreakingNewsBar />}

      <nav className="border-b border-white/8 bg-[#090813]" aria-label="Today on GTA VI World">
        <div className="scrollbar-hidden site-shell flex min-h-12 items-center gap-1 overflow-x-auto py-1.5">
          <span className="mr-2 shrink-0 text-[0.62rem] font-black tracking-[0.18em] text-zinc-600 uppercase">
            Today
          </span>
          {todayLinks.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section className="relative isolate overflow-hidden py-10 sm:py-14 lg:py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(244,114,182,0.17),transparent_30%),radial-gradient(circle_at_88%_38%,rgba(103,232,249,0.13),transparent_32%)]" />
        <div className="site-shell grid items-center gap-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-12 xl:gap-16">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="eyebrow">Today&apos;s lead</span>
              <VerificationBadge status={heroStory.verification} />
              <span className="rounded-full border border-white/10 px-2.5 py-1.5 text-[0.62rem] font-black tracking-widest text-zinc-400 uppercase">
                Evidence first
              </span>
            </div>
            <h1 className="mt-5 text-balance text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.4rem] xl:text-[3.5rem]">
              {heroStory.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
              {heroStory.summary}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-zinc-500 sm:text-sm">
              <span className="font-bold text-pink-300">{heroStory.category}</span>
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4" />
                {formatEditorialDate(heroStory.datePublished)}
              </span>
              <span>{heroStory.readingMinutes} min read</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
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
            <StoryArtwork media={heroStory.heroMedia} aspect="wide" priority priorityLabel="GTA VI WORLD ORIGINAL" />
          </Link>
        </div>
      </section>

      <section id="latest" className="scroll-mt-24 border-y border-white/8 bg-[#0c0b13] py-16 sm:py-20">
        <div className="site-shell">
          <SectionHeading
            eyebrow="The newsroom"
            title="Latest GTA VI news"
            description="The newest reporting, analysis, and reference updates—each clearly labeled so readers can separate facts from interpretation."
            link={{ label: "All latest", href: "/latest" }}
          />
          <div
            className={`grid gap-8 ${
              siteFeatures.audienceRankings
                ? "lg:grid-cols-[minmax(0,1fr)_22rem]"
                : ""
            }`}
          >
            <div
              className={`grid gap-5 sm:grid-cols-2 ${
                siteFeatures.audienceRankings ? "" : "lg:grid-cols-4"
              }`}
            >
              {latestStories.map((story) => (
                <StoryCard key={story.storyId} story={story} />
              ))}
            </div>
            {siteFeatures.audienceRankings && (
              <aside id="trending" className="scroll-mt-24 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <p className="eyebrow">Reader ranking</p>
                <span className="inline-flex items-center gap-2 text-[0.62rem] font-black tracking-[0.14em] text-zinc-500 uppercase">
                  <span className="h-2 w-2 rounded-full bg-pink-300 shadow-[0_0_12px_rgba(244,114,182,.8)]" />
                  Reader interest
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">Trending Now</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                A rolling view of the GTA VI stories drawing the most reader attention.
              </p>
              <div className="mt-6">
                <TrendingList stories={trendingStories} />
              </div>
              </aside>
            )}
          </div>
        </div>
      </section>

      {liveQuickHits.length > 0 && (
        <section id="quick-hits" className="scroll-mt-24 py-16 sm:py-20">
        <div className="site-shell">
          <SectionHeading
            eyebrow="13-second intelligence"
            title="GTA VI Quick Hits"
            description="Fast, vertical GTA VI briefings with verification labels attached. Tap to continue into the full story; nothing autoplays."
            link={{ label: "Open Quick Hits", href: "/quick-hits" }}
          />
          <div className="scrollbar-hidden grid grid-flow-col auto-cols-[78%] gap-4 overflow-x-auto pb-4 sm:auto-cols-[45%] lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible">
            {liveQuickHits.slice(0, 3).map((video) => (
              <QuickHitCard key={video.videoId} video={video} />
            ))}
          </div>
        </div>
        </section>
      )}

      {siteFeatures.audienceRankings && (
        <section id="popular" className="scroll-mt-24 border-t border-white/8 bg-[#0c0b13] py-16 sm:py-20">
        <div className="site-shell">
          <SectionHeading
            eyebrow="The stories readers open next"
            title="Most Popular"
            description="High-interest GTA VI explainers, character files, and world analysis in one place."
            link={{ label: "Browse all news", href: "/latest" }}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mostPopularStories.map((story) => (
              <StoryCard key={story.storyId} story={story} />
            ))}
          </div>
        </div>
        </section>
      )}

      <NewsletterSignup />

      <section className="bg-[radial-gradient(circle_at_20%_50%,rgba(103,232,249,0.08),transparent_30%),radial-gradient(circle_at_80%_50%,rgba(244,114,182,0.09),transparent_30%)] py-10 sm:py-12">
        <div className="site-shell rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
          <div className="grid items-center gap-6 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="eyebrow">Trust layer</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                Know what is verified
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                Every story carries a visible status, from primary-source confirmation to clearly labeled speculation.
              </p>
              <Link
                href="/verification"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 px-4 text-sm font-bold text-white hover:border-cyan-300/40"
              >
                How verification works
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-2.5 lg:justify-end">
              {verificationStatuses.map((status) => (
                <div key={status} title={verificationDetails[status].short}>
                  <VerificationBadge status={status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
