import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { QuickHitCard } from "@/components/quick-hit-card";
import { quickHits } from "@/data/content";

export const metadata: Metadata = {
  title: "GTA VI Quick Hits",
  description:
    "Browse the GTA VI World 13-second vertical video interface with visible source and verification labels.",
  alternates: { canonical: "/quick-hits" },
};

export default function QuickHitsPage() {
  return (
    <div className="min-h-screen py-10 sm:py-14">
      <div className="site-shell">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Quick Hits" }]} />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <p className="eyebrow">Vertical news · 0:13</p>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">
              GTA VI Quick Hits
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
              A mobile-first stream for fast stories. These are static development concepts—no video autoplays, and every item keeps its verification status attached.
            </p>
          </div>
          <aside className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5 text-sm leading-6 text-cyan-100/75">
            Future pipeline: quick hit → performance data → viral score → winning topic → long video → article.
          </aside>
        </div>

        <section id="all-clips" className="mt-12" aria-labelledby="all-clips-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Sample feed</p>
              <h2 id="all-clips-heading" className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">
                All clips
              </h2>
            </div>
            <p className="text-xs font-bold tracking-widest text-zinc-600 uppercase">
              {quickHits.length} concepts
            </p>
          </div>
          <div className="mt-7 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quickHits.map((video) => (
              <QuickHitCard key={video.videoId} video={video} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
