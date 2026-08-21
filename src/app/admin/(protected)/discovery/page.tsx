import Link from "next/link";

import { DiscoveryCandidateCard } from "@/components/admin/discovery-candidate-card";
import { requireEditor } from "@/lib/auth/dal";
import { getDiscoveryControls, getDiscoveryDashboard } from "@/lib/discovery/admin-queries";

import { updateDiscoveryAlert } from "./actions";

const groups = [
  ["Urgent", (score: number, status: string) => score >= 90 && !["REJECTED", "ARCHIVED"].includes(status)],
  ["New", (_score: number, status: string) => status === "DISCOVERED"],
  ["High priority", (score: number, status: string) => score >= 75 && score < 90 && !["REJECTED", "ARCHIVED"].includes(status)],
  ["Needs fact check", (_score: number, status: string, verification: string) => status === "RESEARCHING" || ["RUMOR", "ALLEGED_LEAK"].includes(verification)],
  ["SEO opportunities", (_score: number, status: string, _verification: string, seo: number) => seo >= 70 && !["REJECTED", "ARCHIVED"].includes(status)],
  ["Duplicates", (_score: number, status: string) => status === "DUPLICATE"],
  ["Rejected", (_score: number, status: string) => status === "REJECTED"],
] as const;

export default async function DiscoveryDashboardPage() {
  const editor = await requireEditor();
  const dashboard = await getDiscoveryDashboard(editor);
  const controls = editor.role === "AUTHOR" || editor.role === "FACT_CHECKER" ? null : await getDiscoveryControls();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">News intelligence</p>
          <h1 className="mt-2 text-4xl font-black">Story discovery</h1>
          <p className="mt-3 max-w-3xl text-slate-300">Candidates remain separate from stories until an editor deliberately promotes one. No monitoring or publishing runs automatically.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 font-bold hover:border-cyan-300" href="/admin/discovery/controls" prefetch={false}>Safety controls</Link>
          <Link className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 font-bold hover:border-cyan-300" href="/admin/discovery/sources" prefetch={false}>Source registry</Link>
          <Link className="min-h-11 rounded-full bg-cyan-300 px-5 py-2.5 font-black text-slate-950" href="/admin/seo/opportunities" prefetch={false}>SEO opportunities</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-sm font-bold text-slate-400">Candidates</p><p className="mt-2 text-4xl font-black">{dashboard.candidates.length}</p></article>
        <article className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-5"><p className="text-sm font-bold text-fuchsia-200">New alerts</p><p className="mt-2 text-4xl font-black">{dashboard.alerts.filter((alert) => alert.status === "NEW").length}</p></article>
        <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5"><p className="text-sm font-bold text-cyan-200">Healthy sources</p><p className="mt-2 text-4xl font-black">{dashboard.sourceHealth.HEALTHY ?? 0}</p></article>
        <article className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-5"><p className="text-sm font-bold text-amber-200">Recurring monitoring</p><p className="mt-2 text-xl font-black">{controls?.settings?.recurringMonitoringEnabled ? "Configured" : "OFF"}</p></article>
      </section>

      {dashboard.alerts.length ? (
        <section className="mt-8 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/[0.045] p-5 sm:p-7">
          <h2 className="text-xl font-black">Newsroom alerts</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {dashboard.alerts.map((alert) => (
              <article className="rounded-2xl border border-white/10 bg-black/20 p-5" key={alert.id}>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200">{alert.alertType.replaceAll("_", " ")} · {alert.priority}</p>
                <h3 className="mt-2 font-black">{alert.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{alert.detail}</p>
                <form action={updateDiscoveryAlert} className="mt-4 flex flex-wrap gap-2"><input name="alertId" type="hidden" value={alert.id} /><button className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-bold" name="status" value="ACKNOWLEDGED">Acknowledge</button><button className="min-h-10 rounded-full border border-emerald-300/30 px-4 text-sm font-bold text-emerald-200" name="status" value="RESOLVED">Resolve</button><button className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-bold text-slate-300" name="status" value="DISMISSED">Dismiss</button></form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-10 space-y-12">
        {groups.map(([label, predicate]) => {
          const candidates = dashboard.candidates.filter(({ candidate }) => predicate(candidate.newsworthinessScore, candidate.status, candidate.verificationRecommendation, candidate.seoOpportunityScore));
          if (!candidates.length) return null;
          return <section key={label}><div className="flex items-end justify-between gap-4"><h2 className="text-2xl font-black">{label}</h2><span className="text-sm font-bold text-slate-500">{candidates.length}</span></div><div className="mt-5 grid gap-5 xl:grid-cols-2">{candidates.map((row) => <DiscoveryCandidateCard key={row.candidate.id} row={row} />)}</div></section>;
        })}
      </div>
      {!dashboard.candidates.length ? <section className="mt-10 rounded-3xl border border-dashed border-white/15 p-10 text-center"><h2 className="text-2xl font-black">No discovery candidates yet</h2><p className="mx-auto mt-3 max-w-2xl text-slate-400">This is the safe starting state. Manual test fetches must pass before recurring monitoring can be considered.</p></section> : null}
    </div>
  );
}
