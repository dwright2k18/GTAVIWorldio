import Link from "next/link";

import { ScorePill } from "@/components/admin/score-pill";
import { requireEditor } from "@/lib/auth/dal";
import { getSeoOpportunities } from "@/lib/discovery/admin-queries";

export default async function SeoOpportunitiesPage() {
  await requireEditor(["OWNER", "ADMIN", "EDITOR"]);
  const rows = await getSeoOpportunities();
  return <div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Discovery intelligence</p><h1 className="mt-2 text-4xl font-black">SEO opportunities</h1><p className="mt-3 max-w-3xl text-slate-300">These are update and search-intent signals—not instructions to create thin pages or keyword variants.</p><div className="mt-8 space-y-5">{rows.map(({ candidate, sourceName, evergreenPath, evergreenTitle }) => <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7" key={candidate.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-cyan-300">{sourceName}</p><h2 className="mt-2 text-xl font-black"><Link className="hover:text-cyan-300" href={`/admin/discovery/${candidate.id}`}>{candidate.title}</Link></h2></div><ScorePill label="SEO" score={candidate.seoOpportunityScore} /></div><div className="mt-5 grid gap-5 md:grid-cols-3"><div><h3 className="text-sm font-black text-slate-400">Search intent</h3><p className="mt-2 text-sm leading-6">{candidate.searchIntent ?? "Not classified"}</p></div><div><h3 className="text-sm font-black text-slate-400">Evergreen target</h3><p className="mt-2 text-sm leading-6">{evergreenPath ? `${evergreenTitle} · ${evergreenPath}` : candidate.evergreenRecommendation ?? "No update recommended"}</p></div><div><h3 className="text-sm font-black text-slate-400">Keywords</h3><p className="mt-2 text-sm leading-6">{candidate.suggestedKeywords.length ? candidate.suggestedKeywords.join(" · ") : "None yet"}</p></div></div></article>)}{!rows.length ? <section className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400">No SEO opportunities have been discovered yet.</section> : null}</div></div>;
}
