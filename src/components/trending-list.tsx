import Link from "next/link";
import { VerificationBadge } from "@/components/verification-badge";
import type { Story } from "@/lib/types";

export function TrendingList({ stories }: { stories: Story[] }) {
  return (
    <ol className="divide-y divide-white/8">
      {stories.map((story, index) => (
        <li key={story.storyId} className="grid grid-cols-[2.5rem_1fr] gap-3 py-5 first:pt-0 last:pb-0">
          <span className="text-3xl font-black tracking-[-0.08em] text-white/20">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <VerificationBadge status={story.verification} compact />
              <span className="text-[0.62rem] font-black tracking-widest text-zinc-500 uppercase">
                Score {story.metrics.trendingScore}
              </span>
            </div>
            <Link
              href={`/stories/${story.slug}`}
              className="text-base font-bold leading-6 text-zinc-100 hover:text-pink-200"
            >
              {story.headline}
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
