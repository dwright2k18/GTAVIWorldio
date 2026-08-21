import Link from "next/link";

import { VerificationBadge } from "@/components/verification-badge";
import type { VerificationStatus } from "@/lib/types";

export type CmsStoryCardData = {
  id: string;
  headline: string;
  urlPath: string;
  summary: string;
  verificationStatus: string;
  categoryName?: string | null;
  publishedAt?: Date | null;
};

export function CmsStoryCard({ story }: { story: CmsStoryCardData }) {
  return <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><VerificationBadge compact status={story.verificationStatus.replaceAll('_',' ') as VerificationStatus} />{story.categoryName ? <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-pink-300">{story.categoryName}</span> : null}</div><h3 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl"><Link className="inline-flex min-h-11 items-center hover:text-pink-200" href={story.urlPath}>{story.headline}</Link></h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">{story.summary}</p>{story.publishedAt ? <time className="mt-5 block border-t border-white/8 pt-4 text-xs text-zinc-500" dateTime={story.publishedAt.toISOString()}>{story.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time> : null}</article>;
}
