import Image from "next/image";
import type { EditorialMedia } from "@/lib/types";

export function StoryArtwork({
  media,
  aspect = "wide",
  priorityLabel,
  priority = false,
  sizes,
  showLabel = true,
}: {
  media: EditorialMedia;
  aspect?: "wide" | "card" | "vertical";
  priorityLabel?: string;
  priority?: boolean;
  sizes?: string;
  showLabel?: boolean;
}) {
  const aspectClass = {
    wide: "aspect-[16/9]",
    card: "aspect-[4/3]",
    vertical: "aspect-[9/16]",
  }[aspect];
  const responsiveSizes = sizes ?? {
    wide: "(min-width: 1024px) 52vw, 100vw",
    card: "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw",
    vertical: "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 78vw",
  }[aspect];

  return (
    <div
      className={`story-artwork relative isolate overflow-hidden ${aspectClass}`}
      style={{ background: media.gradient }}
      role={media.src ? undefined : "img"}
      aria-label={media.src ? undefined : media.alt}
    >
      {media.src && (
        <Image
          src={media.src}
          alt={media.alt}
          fill
          priority={priority}
          sizes={responsiveSizes}
          className="object-cover"
          style={{ objectPosition: media.focalPoint ?? "center" }}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] bg-[size:42px_42px] opacity-35" />
      <div className="absolute -top-1/4 -right-1/4 h-3/4 w-3/4 rounded-full border border-white/25" />
      <div className="absolute top-[15%] right-[8%] h-[18%] w-[18%] rounded-full bg-white/12 blur-xl" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
      {showLabel && <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 sm:inset-x-7 sm:bottom-7">
        <div>
          {priorityLabel && (
            <p className="mb-2 text-[0.62rem] font-black tracking-[0.2em] text-white/70">
              {priorityLabel}
            </p>
          )}
          <p className="text-sm font-black tracking-[0.18em] text-white sm:text-base">
            {media.label}
          </p>
        </div>
        <span
          className="text-4xl font-black tracking-[-0.09em] text-white/80 sm:text-6xl"
          style={{ textShadow: `0 0 34px ${media.accent}` }}
          aria-hidden="true"
        >
          VI
        </span>
      </div>}
    </div>
  );
}
