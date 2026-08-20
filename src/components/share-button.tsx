"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/icons";

export function ShareButton({
  title,
  path,
  compact = false,
}: {
  title: string;
  path: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState("Share");

  async function handleShare() {
    const url = new URL(path, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setStatus("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("Copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Try again");
    }

    window.setTimeout(() => setStatus("Share"), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-black/25 font-bold text-white backdrop-blur transition-colors hover:border-cyan-300/40 hover:bg-black/40 ${
        compact ? "h-10 w-10" : "h-11 px-4 text-sm"
      }`}
      aria-label={`Share ${title}`}
    >
      <ShareIcon className="h-4 w-4" />
      {!compact && <span aria-live="polite">{status}</span>}
    </button>
  );
}
