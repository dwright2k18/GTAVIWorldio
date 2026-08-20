import Link from "next/link";
import { footerNavigation } from "@/data/navigation";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#07060d]">
      <div className="site-shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_.75fr_.85fr_.85fr] lg:py-16">
        <div>
          <Logo />
          <p className="mt-5 max-w-md text-sm leading-6 text-zinc-400">
            Independent GTA VI reporting with visible sourcing and verification labels. Built for readers who want the excitement without losing the evidence.
          </p>
          <p className="mt-5 max-w-md text-xs leading-5 text-zinc-600">
            GTA VI World is an independent fan publication and is not owned, operated, sponsored, or endorsed by Rockstar Games or Take-Two Interactive.
          </p>
        </div>
        {Object.entries(footerNavigation).map(([section, links]) => (
          <div key={section}>
            <h2 className="text-xs font-black tracking-[0.16em] text-zinc-300 uppercase">
              {section}
            </h2>
            <ul className="mt-4 space-y-3">
              {links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-zinc-500 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/8">
        <div className="site-shell flex flex-col gap-2 py-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getUTCFullYear()} GTA VI World. Independent publication.</p>
          <p>Original visual system · Editorial imagery used only with approval</p>
        </div>
      </div>
    </footer>
  );
}
