import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export function BreakingNewsBar() {
  return (
    <aside className="border-b border-white/10 bg-gradient-to-r from-pink-500/14 via-transparent to-cyan-400/12" aria-label="Breaking news">
      <Link
        href="/stories/everything-officially-confirmed-so-far"
        className="site-shell flex min-h-11 items-center gap-3 py-2.5 text-sm"
      >
        <span className="shrink-0 rounded-full bg-pink-400 px-2.5 py-1 text-[0.64rem] font-black tracking-[0.14em] text-[#160815]">
          BREAKING DESK
        </span>
        <span className="truncate font-semibold text-zinc-200">
          Demo feed: See how GTA VI World separates confirmed facts from rumor
        </span>
        <ArrowRightIcon className="ml-auto h-4 w-4 shrink-0 text-cyan-300" />
      </Link>
    </aside>
  );
}
