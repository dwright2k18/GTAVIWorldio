import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnalyticsEvent } from "@/components/analytics-event";
import { SearchIcon } from "@/components/icons";
import { QuickHitCard } from "@/components/quick-hit-card";
import { StoryCard } from "@/components/story-card";
import { searchContent } from "@/data/content";
import { siteFeatures } from "@/lib/site";

export const metadata: Metadata = {
  title: "Search",
  description: "Search GTA VI World stories, analysis, characters, and locations.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: false },
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = firstValue((await searchParams).q) ?? "";
  const results = searchContent(query);
  const liveQuickHits = siteFeatures.quickHits
    ? results.quickHits.filter((video) => Boolean(video.video))
    : [];
  const resultCount = results.stories.length + liveQuickHits.length;
  const suggestions = ["Lucia", "Jason", "Map", "Vice City", "Trailer", "Gameplay"];

  return (
    <div className="min-h-screen py-10 sm:py-14">
      {query && (
        <AnalyticsEvent
          name="search_use"
          data={{ query, resultCount }}
        />
      )}
      <div className="site-shell">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
        <div className="mx-auto mt-9 max-w-3xl text-center">
          <p className="eyebrow">Find the signal</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">
            Search GTA VI World
          </h1>
          <form action="/search" className="relative mt-8" role="search">
            <label htmlFor="site-search" className="sr-only">
              Search stories
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              id="site-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Try Lucia, Vice City, map, trailer…"
              className="h-15 w-full rounded-full border border-white/12 bg-white/[0.055] pr-30 pl-13 text-base text-white placeholder:text-zinc-600 focus:border-cyan-300/50 focus:outline-none"
              autoComplete="off"
            />
            <button
              type="submit"
              className="absolute top-1.5 right-1.5 h-12 rounded-full bg-white px-5 text-sm font-black text-[#090813]"
            >
              Search
            </button>
          </form>
          <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Suggested searches">
            {suggestions.map((suggestion) => (
              <Link
                key={suggestion}
                href={`/search?q=${encodeURIComponent(suggestion)}`}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-white"
              >
                {suggestion}
              </Link>
            ))}
          </div>
        </div>

        {query ? (
          <div className="mt-14">
            <p className="text-sm text-zinc-500" aria-live="polite">
              {resultCount} {resultCount === 1 ? "result" : "results"} for “{query}”
            </p>
            {resultCount > 0 ? (
              <>
                {results.stories.length > 0 && (
                  <section className="mt-6" aria-labelledby="story-results">
                    <h2 id="story-results" className="text-2xl font-black text-white">
                      Stories
                    </h2>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {results.stories.map((story) => (
                        <StoryCard key={story.storyId} story={story} />
                      ))}
                    </div>
                  </section>
                )}
                {liveQuickHits.length > 0 && (
                  <section className="mt-14" aria-labelledby="video-results">
                    <h2 id="video-results" className="text-2xl font-black text-white">
                      Quick Hits
                    </h2>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      {liveQuickHits.map((video) => (
                        <QuickHitCard key={video.videoId} video={video} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
                <h2 className="text-2xl font-black text-white">No matching stories</h2>
                <p className="mt-3 text-zinc-400">Try a character, location, category, or verification status.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto mt-16 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-black text-white">Search the GTA VI newsroom</h2>
            <p className="mt-3 leading-7 text-zinc-400">
              Search story headlines, summaries, categories, tags, and verification statuses from one place.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
