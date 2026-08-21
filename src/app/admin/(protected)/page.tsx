import Link from "next/link";

import { requireEditor } from "@/lib/auth/dal";
import { getAdminDashboard } from "@/lib/cms/admin-queries";

const workflowCards = [
  ["Drafts", "DRAFTING"],
  ["Needs review", "NEEDS_REVIEW"],
  ["Fact check", "FACT_CHECK"],
  ["Scheduled", "SCHEDULED"],
  ["Published", "PUBLISHED"],
  ["Updated", "UPDATED"],
] as const;

export default async function AdminDashboardPage() {
  const editor = await requireEditor();
  const dashboard = await getAdminDashboard(editor);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">GTAVIWorldio newsroom</p><h1 className="mt-2 text-4xl font-black tracking-tight">Editorial dashboard</h1><p className="mt-3 max-w-2xl text-slate-300">CMS records remain private until their workflow status and publication requirements are explicitly satisfied.</p></div>
        <Link className="min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950" href="/admin/stories/new">Create story</Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {workflowCards.map(([label, status]) => <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5" key={status}><p className="text-sm font-bold text-slate-400">{label}</p><p className="mt-2 text-4xl font-black">{dashboard.counts[status] ?? 0}</p></article>)}
      </section>

      <section className="mt-8 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/[0.035] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Discovery desk</p><h2 className="mt-2 text-xl font-black">Automated monitoring remains off</h2><p className="mt-2 text-sm leading-6 text-slate-300">{dashboard.candidateCounts.DISCOVERED ?? 0} new candidates · {dashboard.discoveryAlerts.filter((alert) => alert.status === "NEW").length} new alerts. Candidates never publish automatically.</p></div>
          <Link className="min-h-11 rounded-full border border-fuchsia-300/40 px-5 py-2.5 font-bold text-fuchsia-100" href="/admin/discovery" prefetch={false}>Open discovery</Link>
        </div>
        {dashboard.discoveryAlerts.length ? <ul className="mt-5 grid gap-3 lg:grid-cols-2">{dashboard.discoveryAlerts.map((alert) => <li className="rounded-2xl border border-white/10 bg-black/20 p-4" key={alert.id}><p className="text-xs font-black uppercase tracking-wider text-fuchsia-200">{alert.alertType.replaceAll("_", " ")} · {alert.priority}</p><p className="mt-2 font-bold">{alert.title}</p></li>)}</ul> : null}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><h2 className="text-xl font-black">Upcoming schedule</h2>{dashboard.scheduled.length ? <ul className="mt-5 space-y-3">{dashboard.scheduled.map((story) => <li key={story.id}><Link className="font-bold hover:text-cyan-300" href={`/admin/stories/${story.id}`}>{story.headline}</Link><p className="text-sm text-slate-400">{story.scheduledFor?.toLocaleString("en-US", { timeZone: story.scheduledTimezone, timeZoneName: "short" })}</p></li>)}</ul> : <p className="mt-4 text-slate-400">No stories are scheduled.</p>}</section>
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"><h2 className="text-xl font-black">Evergreen review queue</h2><ul className="mt-5 space-y-3">{dashboard.staleEvergreen.map((page) => <li key={page.id}><p className="font-bold">{page.title}</p><p className="text-sm text-slate-400">{page.lastReviewedAt ? `Reviewed ${page.lastReviewedAt.toLocaleDateString("en-US")}` : "Not yet reviewed"}</p></li>)}</ul></section>
      </div>
    </div>
  );
}
