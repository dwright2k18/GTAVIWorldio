import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { AnalyticsLink } from "@/components/analytics-link";
import { QuickHitVideo } from "@/components/quick-hit-video";
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
      <div className="relative isolate aspect-[9/16] overflow-hidden rounded-[1.7rem] border border-white/15 bg-white/[0.035] shadow-xl shadow-black/20 transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-pink-300/30">
        {video.video ? (
          <QuickHitVideo video={video.video} videoId={video.videoId} headline={video.headline} />
        ) : (
          <StoryArtwork
            media={video.media}
            aspect="vertical"
            showLabel={false}
            sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 28vw, (min-width: 640px) 45vw, 78vw"
          />
        )}

        {!video.video && (
          <AnalyticsLink
            href={storyPath}
            eventName="quick_hit_play"
            eventData={{ videoId: video.videoId, mediaConnected: false }}
            className="absolute inset-0 z-10 grid place-items-center bg-black/5"
            aria-label={`Open story for ${video.headline}`}
          >
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/45 bg-black/40 text-white shadow-[0_0_40px_rgba(244,114,182,0.3)] backdrop-blur-md transition-transform group-hover:scale-105">
              <PlayIcon className="ml-1 h-7 w-7" />
            </span>
          </AnalyticsLink>
        )}

        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[0.62rem] font-black tracking-[0.16em] text-white backdrop-blur-md">
            QUICK HIT
          </span>
          <span className="rounded-full bg-pink-400 px-2.5 py-1 text-[0.62rem] font-black text-[#180713]">
            0:13
          </span>
        </div>
        <div className="absolute top-14 right-4 z-20">
          <ShareButton title={video.headline} path={`/quick-hits#${video.videoId}`} compact />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#090813] via-[#090813]/90 to-transparent px-5 pt-20 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={video.verification} compact />
            <span className="text-[0.62rem] font-black tracking-[0.15em] text-pink-200 uppercase">
              {video.category}
            </span>
          </div>
          <h3 className="mt-3 text-balance text-xl font-black leading-6 tracking-[-0.025em] text-white">
            {video.headline}
          </h3>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full w-1/4 rounded-full bg-gradient-to-r from-cyan-300 to-pink-300" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[0.62rem] font-bold text-white/60">
            <span>0:00</span>
            <span>{formatEditorialDate(video.publishedAt)}</span>
          </div>
        </div>
      </div>
      <Link
        href={storyPath}
        className="mt-3 inline-flex min-h-11 items-center gap-2 px-1 text-xs font-black tracking-[0.13em] text-zinc-400 uppercase hover:text-white"
      >
        Open full story
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
