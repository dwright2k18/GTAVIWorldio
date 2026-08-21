"use client";

import { trackEvent } from "@/lib/analytics";
import type { EditorialVideo } from "@/lib/types";

export function QuickHitVideo({
  video,
  videoId,
  headline,
}: {
  video: EditorialVideo;
  videoId: string;
  headline: string;
}) {
  return (
    <video
      className="absolute inset-0 h-full w-full object-cover"
      controls
      playsInline
      preload="metadata"
      poster={video.poster}
      aria-label={headline}
      onPlay={() => trackEvent("quick_hit_play", { videoId })}
    >
      <source src={video.src} type={video.mimeType ?? "video/mp4"} />
      {video.captions && (
        <track kind="captions" src={video.captions} srcLang="en" label="English" default />
      )}
    </video>
  );
}
