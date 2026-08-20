import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { ShareButton } from "@/components/share-button";
import { StoryArtwork } from "@/components/story-artwork";
import { VerificationBadge } from "@/components/verification-badge";
import { getStoryById } from "@/data/content";
import { formatEditorialDate } from "@/lib/format";
import type { QuickHit } from "@/lib/types";

export function QuickHitCard({ video }: { video: QuickHit }) {
  const story = getStoryById(video.storyId);
  const storyPath = story ? `/stories/${story.slug}` : "/quick-hits";

  return (
    <article id={video.videoId} className="group min-w-0">
      <div className="relative overflow-hidden rounded-[1.7rem] border border-white/12 bg-white/[0.035]">
        <StoryArtwork media={video.media} aspect="vertical" priorityLabel="13 SECOND QUICK HIT" />
        <div className="absolute inset-0 grid place-items-center bg-black/5">
          <Link
            href={storyPath}
            className="grid h-15 w-15 place-items-center rounded-full border border-white/35 bg-black/35 text-white backdrop-blur transition-transform group-hover:scale-105"
            aria-label={`Open story for ${video.headline}`}
          >
            <PlayIcon className="ml-1 h-6 w-6" />
          </Link>
        </div>
        <div className="absolute top-4 right-4">
          <ShareButton title={video.headline} path={`/quick-hits#${video.videoId}`} compact />
        </div>
        <span className="absolute right-4 bottom-4 rounded-full bg-black/55 px-2.5 py-1 text-[0.68rem] font-black text-white backdrop-blur">
          0:13
        </span>
      </div>
      <div className="px-1 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge status={video.verification} compact />
          <span className="text-[0.65rem] font-black tracking-widest text-pink-300 uppercase">
            {video.category}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-bold leading-6 text-white">
          <Link href={storyPath} className="hover:text-pink-200">
            {video.headline}
          </Link>
        </h3>
        <p className="mt-2 text-xs text-zinc-500">
          {formatEditorialDate(video.publishedAt)} · Sample video concept
        </p>
      </div>
    </article>
  );
}
