import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CmsStoryCard } from "@/components/cms-story-card";
import { listPublishedArchive } from "@/lib/cms/public-queries";

export const metadata: Metadata = {
  title: "Latest GTA VI News",
  description: "Latest GTA VI reporting with source records, verification labels, and a controlled editorial workflow.",
  alternates: { canonical: "/news" },
};

type NewsPageProps = { searchParams: Promise<{ page?: string }> };

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const stories = await listPublishedArchive(page, 20);

  return <main className="min-h-screen py-10 sm:py-14"><div className="site-shell"><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News" }]} /><header className="mt-9 max-w-4xl"><p className="eyebrow">The verified news desk</p><h1 className="mt-4 text-5xl font-black tracking-[-0.055em] text-white sm:text-7xl">Latest GTA VI News</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">Reporting moves from discovery through sourcing, fact check, review, and approval before it appears here.</p></header>{stories.length ? <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{stories.map((story) => <CmsStoryCard key={story.id} story={story} />)}</section> : <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-8"><h2 className="text-2xl font-black text-white">The live news desk is being prepared</h2><p className="mt-3 max-w-2xl leading-7 text-zinc-400">No newsroom story has completed the full publication workflow yet. Existing editorial reference material remains available under Latest while records are sourced and reviewed.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 font-bold hover:border-cyan-300" href="/latest">Browse current editorial material</Link></section>}{page > 1 || stories.length === 20 ? <nav aria-label="News pagination" className="mt-10 flex gap-3">{page > 1 ? <Link className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 font-bold" href={`/news?page=${page - 1}`}>Previous</Link> : null}{stories.length === 20 ? <Link className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 font-bold" href={`/news?page=${page + 1}`}>Next</Link> : null}</nav> : null}</div></main>;
}
