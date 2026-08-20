import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex min-h-11 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-400"
      aria-label="GTA VI World home"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 via-pink-400 to-orange-300 text-sm font-black text-[#090813] shadow-[0_0_24px_rgba(244,114,182,0.2)] transition-transform group-hover:-rotate-3">
        VI
      </span>
      {!compact && (
        <span className="text-[0.94rem] font-black tracking-[-0.045em] text-white sm:text-base">
          GTA<span className="text-pink-400">VI</span>WORLD
          <span className="ml-1 text-[0.58rem] tracking-[0.08em] text-cyan-300">
            .IO
          </span>
        </span>
      )}
    </Link>
  );
}
