import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ArrowRightIcon } from "@/components/icons";
import { VerificationBadge } from "@/components/verification-badge";
import { verificationDetails } from "@/data/content";
import { absoluteUrl } from "@/lib/site";
import { verificationStatuses } from "@/lib/types";

export const metadata: Metadata = {
  title: "How GTA VI World Verifies News",
  description:
    "Understand the five verification labels GTA VI World uses to separate confirmed GTA VI news, sourced reports, rumors, speculation, and alleged leaks.",
  alternates: { canonical: "/verification" },
  openGraph: {
    title: "How GTA VI World Verifies News",
    description:
      "Five clear labels help readers see what is confirmed, reported, rumored, speculative, or alleged.",
    url: "/verification",
  },
};

const statusPrinciples = {
  CONFIRMED: "A primary source is available and linked wherever possible.",
  "CREDIBLE REPORT": "The reporting is attributable to a reliable publication or reporter.",
  RUMOR: "The claim remains unverified and is never presented as established fact.",
  SPECULATION: "The conclusion is analysis or theory, even when it begins with official material.",
  "ALLEGED LEAK": "The material is purportedly non-public and its authenticity is not established.",
} as const;

export default function VerificationPage() {
  const pageUrl = absoluteUrl("/verification");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "How GTA VI World Verifies News",
    description:
      "The GTA VI World verification standard for confirmed news, sourced reporting, rumors, speculation, and alleged leaks.",
    url: pageUrl,
  };

  return (
    <div className="min-h-screen py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="site-shell">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Verification" }]} />

        <header className="mt-9 max-w-4xl">
          <p className="eyebrow">The trust standard</p>
          <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">
            Know what&apos;s verified before you share it
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-300 sm:text-xl sm:leading-8">
            GTA VI moves fast. Our five-label system makes the evidence level visible on every story and Quick Hit, so excitement never has to come at the expense of clarity.
          </p>
        </header>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-labelledby="status-heading">
          <h2 id="status-heading" className="sr-only">The five verification statuses</h2>
          {verificationStatuses.map((status) => (
            <article key={status} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:min-h-64">
              <VerificationBadge status={status} />
              <h3 className="mt-5 text-lg font-black text-white">
                {verificationDetails[status].short}
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {verificationDetails[status].description}
              </p>
              <p className="mt-4 border-t border-white/8 pt-4 text-xs leading-5 text-zinc-500">
                {statusPrinciples[status]}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-8 rounded-[2rem] border border-cyan-300/15 bg-cyan-300/[0.045] p-6 sm:p-9 lg:grid-cols-[1fr_.85fr]" aria-labelledby="promise-heading">
          <div>
            <p className="eyebrow">Our editorial promise</p>
            <h2 id="promise-heading" className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">
              Labels follow the evidence
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              A story can move between statuses when stronger sourcing arrives. Updates retain publication dates, corrections stay visible, and source links sit close to the claims they support.
            </p>
          </div>
          <ul className="space-y-3 text-sm leading-6 text-zinc-300">
            <li className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">Primary sources lead confirmed coverage.</li>
            <li className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">Interpretation is separated from observation.</li>
            <li className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">Unverified material never inherits a confirmed label.</li>
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/latest" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#090813]">
            Browse latest news
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link href="/search" className="inline-flex min-h-12 items-center rounded-full border border-white/12 px-5 text-sm font-bold text-white hover:border-cyan-300/40">
            Search GTA VI World
          </Link>
        </div>
      </div>
    </div>
  );
}
