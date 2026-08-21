"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="site-shell grid min-h-[65vh] place-items-center py-16 text-center">
      <div className="max-w-xl rounded-3xl border border-rose-300/15 bg-rose-300/[0.04] p-8 sm:p-10">
        <p className="eyebrow">Newsroom error</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white">Something interrupted the feed</h1>
        <p className="mt-4 leading-7 text-zinc-400">The page could not finish loading. Try the request again.</p>
        <button type="button" onClick={retry} className="mt-7 min-h-12 rounded-full bg-white px-5 py-3 text-sm font-black text-[#090813]">
          Try again
        </button>
      </div>
    </div>
  );
}
