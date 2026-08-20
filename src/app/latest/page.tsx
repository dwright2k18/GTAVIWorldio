import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StoryCard } from "@/components/story-card";
import { stories } from "@/data/content";
import { verificationStatuses, type StoryCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Latest GTA VI News",
  description:
    "Browse the latest sample GTA VI news, analysis, character guides, and rumor coverage with visible verification labels.",
  alternates: { canonical: "/latest" },
};

type LatestSearchParams = Promise<{
  category?: string | string[];
  verification?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LatestPage({
  searchParams,
}: {
  searchParams: LatestSearchParams;
}) {
  const query = await searchParams;
  const category = firstValue(query.category);
  const verification = firstValue(query.verification);
  const categories = Array.from(new Set(stories.map((story) => story.category)));
  const filteredStories = stories.filter((story) => {
    const matchesCategory = !category || story.category === category;
    const matchesVerification = !verification || story.verification === verification;
    return matchesCategory && matchesVerification;
  });

  return (
    <div className="min-h-screen py-10 sm:py-14">
      <div className="site-shell">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Latest" }]} />
        <div className="mt-8 max-w-3xl">
          <p className="eyebrow">Live architecture · Sample content</p>
          <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">
            Latest GTA VI news
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-400 sm:text-lg">
            A fast editorial feed built around source transparency. Development stories are clearly marked and do not represent new GTA VI announcements.
          </p>
        </div>

        <div className="mt-9 flex flex-wrap gap-2" aria-label="Filter latest stories">
          <Link
            href="/latest"
            className={`rounded-full border px-3.5 py-2 text-xs font-bold ${
              !category && !verification
                ? "border-white bg-white text-[#090813]"
                : "border-white/12 text-zinc-400 hover:text-white"
            }`}
          >
            All stories
          </Link>
          {categories.map((item) => (
            <Link
              key={item}
              href={`/latest?category=${encodeURIComponent(item satisfies StoryCategory)}`}
              className={`rounded-full border px-3.5 py-2 text-xs font-bold ${
                category === item
                  ? "border-pink-300/50 bg-pink-300/12 text-pink-200"
                  : "border-white/12 text-zinc-400 hover:text-white"
              }`}
            >
              {item}
            </Link>
          ))}
          {verificationStatuses.map((status) => (
            <Link
              key={status}
              href={`/latest?verification=${encodeURIComponent(status)}`}
              className={`rounded-full border px-3.5 py-2 text-xs font-bold ${
                verification === status
                  ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-200"
                  : "border-white/12 text-zinc-400 hover:text-white"
              }`}
            >
              {status}
            </Link>
          ))}
        </div>

        <p className="mt-6 text-sm text-zinc-500" aria-live="polite">
          Showing {filteredStories.length} {filteredStories.length === 1 ? "story" : "stories"}
        </p>

        {filteredStories.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStories.map((story) => (
              <StoryCard key={story.storyId} story={story} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-black text-white">No sample stories in this filter yet</h2>
            <p className="mt-3 text-zinc-400">The data model supports this status and is ready for verified newsroom content.</p>
            <Link href="/latest" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-[#090813]">
              Reset filters
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
