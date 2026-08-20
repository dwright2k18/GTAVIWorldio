import Link from "next/link";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="site-shell grid min-h-[68vh] place-items-center py-16 text-center">
      <div className="max-w-2xl">
        <p className="text-8xl font-black tracking-[-0.08em] text-white/10 sm:text-9xl">404</p>
        <p className="eyebrow mt-4">Signal lost</p>
        <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.05em] text-white sm:text-6xl">
          This route left Vice City
        </h1>
        <p className="mt-5 leading-7 text-zinc-400">
          The page may have moved, or the story is not available in the newsroom yet.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#090813]">
            Return home <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link href="/search" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white">
            <SearchIcon className="h-4 w-4" /> Search the site
          </Link>
        </div>
      </div>
    </div>
  );
}
