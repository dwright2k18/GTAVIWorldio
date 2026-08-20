import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import { StoryArtwork } from "@/components/story-artwork";
import { VerificationBadge } from "@/components/verification-badge";
import { formatEditorialDate } from "@/lib/format";
import type { Story } from "@/lib/types";

export function StoryCard({ story }: { story: Story }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition-transform duration-300 hover:-translate-y-1 hover:border-white/20">
      <Link href={`/stories/${story.slug}`} tabIndex={-1} aria-hidden="true">
        <StoryArtwork media={story.heroMedia} aspect="card" />
      </Link>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={story.verification} compact />
          <span className="text-[0.65rem] font-black tracking-[0.12em] text-pink-300 uppercase">
            {story.category}
          </span>
        </div>
        <h3 className="mt-4 text-balance text-xl font-bold tracking-[-0.025em] text-white sm:text-2xl">
          <Link href={`/stories/${story.slug}`} className="hover:text-pink-200">
            {story.headline}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">
          {story.summary}
        </p>
        <div className="mt-5 flex items-center gap-4 border-t border-white/8 pt-4 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5" />
            {formatEditorialDate(story.datePublished)}
          </span>
          <span>{story.readingMinutes} min read</span>
          <ArrowRightIcon className="ml-auto h-4 w-4 text-cyan-300 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </article>
  );
}
