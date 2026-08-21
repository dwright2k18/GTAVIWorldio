import Link from "next/link";

import { Logo } from "@/components/logo";
import { requireEditor } from "@/lib/auth/dal";

import { signOut } from "../actions";

const adminNavigation = [
  ["Dashboard", "/admin"],
  ["Stories", "/admin/stories"],
  ["Discovery", "/admin/discovery"],
  ["Evergreen", "/admin/evergreen"],
  ["Sources", "/admin/sources"],
  ["Taxonomy", "/admin/taxonomy"],
  ["Authors", "/admin/authors"],
  ["Media", "/admin/media"],
  ["Videos", "/admin/videos"],
  ["SEO health", "/admin/seo"],
  ["SEO opportunities", "/admin/seo/opportunities"],
] as const;

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const editor = await requireEditor();

  return (
    <div className="min-h-screen bg-[#070b16] text-white">
      <header className="border-b border-white/10 bg-[#080d1b]/95">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo href="/admin" label="GTAVIWorldio newsroom dashboard" prefetch={false} />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-300 sm:inline">
              {editor.displayName} · {editor.role.replaceAll("_", " ")}
            </span>
            <form action={signOut}>
              <button className="min-h-11 rounded-full border border-white/15 px-4 font-bold hover:border-cyan-300" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Newsroom" className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto px-4 pb-4 sm:px-6">
          {adminNavigation.map(([label, href]) => (
            <Link className="min-h-11 whitespace-nowrap rounded-full border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-cyan-300 hover:text-white" href={href} key={href} prefetch={false}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
