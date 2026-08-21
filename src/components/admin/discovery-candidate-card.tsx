import Link from "next/link";

import type { getDiscoveryDashboard } from "@/lib/discovery/admin-queries";

import { ScorePill } from "./score-pill";

type CandidateRow = Awaited<ReturnType<typeof getDiscoveryDashboard>>["candidates"][number];

export function DiscoveryCandidateCard({ row }: { row: CandidateRow }) {
  const { candidate } = row;
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
        <span className="text-cyan-300">{row.sourceTier.replace("_", " ")}</span>
        <span className="text-slate-500">{row.sourceName}</span>
        {candidate.isTest ? <span className="rounded-full border border-amber-300/40 px-2 py-1 text-amber-200">Test</span> : null}
      </div>
      <h2 className="mt-3 text-xl font-black leading-tight">
        <Link className="hover:text-cyan-300" href={`/admin/discovery/${candidate.id}`} prefetch={false}>
          {candidate.title}
        </Link>
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {candidate.excerpt ?? "No source summary was available. Research must begin from the original link."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ScorePill label="News" score={candidate.newsworthinessScore} />
        <ScorePill label="Confidence" score={candidate.confidenceScore} />
        <ScorePill label="SEO" score={candidate.seoOpportunityScore} />
        <ScorePill label="Trend" score={candidate.trendScore} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        <span>{candidate.status.replaceAll("_", " ")} · {candidate.verificationRecommendation.replaceAll("_", " ")}</span>
        <span>{candidate.discoveredAt.toLocaleString("en-US")}</span>
      </div>
      {row.clusterTitle ? <p className="mt-3 text-xs text-slate-500">Cluster · {row.clusterTitle}</p> : null}
    </article>
  );
}
