import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";

export type PolicySection = {
  title: string;
  content: ReactNode;
};

export function PolicyPage({
  eyebrow,
  title,
  introduction,
  updated = "August 20, 2026",
  sections,
}: {
  eyebrow: string;
  title: string;
  introduction: ReactNode;
  updated?: string;
  sections: PolicySection[];
}) {
  return (
    <div className="min-h-screen py-10 sm:py-14">
      <div className="site-shell">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
        <article className="mx-auto mt-9 max-w-4xl">
          <header>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">
              {title}
            </h1>
            <div className="mt-5 max-w-3xl text-base leading-8 text-zinc-300 sm:text-lg">
              {introduction}
            </div>
            <p className="mt-5 text-xs font-bold tracking-[0.12em] text-zinc-600 uppercase">
              Last updated {updated}
            </p>
          </header>

          <div className="mt-12 space-y-5">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8"
              >
                <h2 className="text-2xl font-black tracking-[-0.035em] text-white">
                  {section.title}
                </h2>
                <div className="policy-copy mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
