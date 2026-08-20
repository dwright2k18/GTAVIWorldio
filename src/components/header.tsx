"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { primaryNavigation } from "@/data/navigation";
import { CloseIcon, MenuIcon, SearchIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090813]/92 backdrop-blur-xl">
      <div className="site-shell flex h-18 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary navigation">
          {primaryNavigation.map((item) => {
            const itemPath = item.href.split("?")[0].split("#")[0];
            const isActive = itemPath === "/" ? pathname === "/" : pathname.startsWith(itemPath);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-full px-3 py-2 text-[0.74rem] font-bold tracking-wide transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-sm font-bold text-zinc-200 transition-colors hover:border-cyan-300/40 hover:text-white"
            aria-label="Search GTA VI World"
          >
            <SearchIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Search</span>
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white xl:hidden"
            aria-controls="mobile-navigation"
            aria-expanded={open}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-navigation"
          className="site-shell grid max-h-[calc(100vh-4.5rem)] grid-cols-2 gap-2 overflow-y-auto border-t border-white/10 py-4 pb-6 sm:grid-cols-3 xl:hidden"
          aria-label="Mobile navigation"
        >
          {primaryNavigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center rounded-xl border border-white/8 bg-white/[0.035] px-4 text-sm font-bold text-zinc-200 hover:border-pink-400/30 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
