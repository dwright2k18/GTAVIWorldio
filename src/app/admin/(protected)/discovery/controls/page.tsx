import { requireEditor } from "@/lib/auth/dal";
import { getDiscoveryControls } from "@/lib/discovery/admin-queries";
import { safeStartingLimits } from "@/lib/discovery/cost";

export default async function DiscoveryControlsPage() {
  await requireEditor(["OWNER", "ADMIN", "EDITOR"]);
  const controls = await getDiscoveryControls();
  const settings = controls.settings;
  const monthlyRequests = controls.usage.reduce((sum, day) => sum + day.requestCount, 0);
  const monthlyCostMicros = controls.usage.reduce((sum, day) => sum + day.estimatedCostMicros, 0);
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Cost and failure safety</p>
      <h1 className="mt-2 text-4xl font-black">Discovery controls</h1>
      <p className="mt-3 max-w-3xl text-slate-300">This page is intentionally read-only during Phase 4 testing. Activation requires a separate approval and environment configuration.</p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.05] p-5"><p className="text-sm font-bold text-rose-200">Recurring monitoring</p><p className="mt-2 text-3xl font-black">{settings?.recurringMonitoringEnabled ? "ON" : "OFF"}</p></article>
        <article className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.05] p-5"><p className="text-sm font-bold text-rose-200">Automatic drafts</p><p className="mt-2 text-3xl font-black">{settings?.automaticDraftingEnabled ? "ON" : "OFF"}</p></article>
        <article className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.05] p-5"><p className="text-sm font-bold text-rose-200">Deep AI research</p><p className="mt-2 text-3xl font-black">{settings?.deepResearchEnabled ? "ON" : "OFF"}</p></article>
      </section>
      <section className="mt-8 overflow-x-auto rounded-3xl border border-white/10"><table className="min-w-full divide-y divide-white/10 text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Limit</th><th className="px-5 py-4">Configured</th><th className="px-5 py-4">Safe starting value</th></tr></thead><tbody className="divide-y divide-white/10"><tr><td className="px-5 py-4">Requests per day</td><td className="px-5 py-4 font-black">{settings?.maxRequestsPerDay ?? 0}</td><td className="px-5 py-4">{safeStartingLimits.maxRequestsPerDay}</td></tr><tr><td className="px-5 py-4">Candidates per run</td><td className="px-5 py-4 font-black">{settings?.maxCandidatesPerRun ?? 0}</td><td className="px-5 py-4">{safeStartingLimits.maxCandidatesPerRun}</td></tr><tr><td className="px-5 py-4">AI triage calls per day</td><td className="px-5 py-4 font-black">{settings?.maxAiTriageCallsPerDay ?? 0}</td><td className="px-5 py-4">0</td></tr><tr><td className="px-5 py-4">AI research calls per day</td><td className="px-5 py-4 font-black">{settings?.maxAiResearchCallsPerDay ?? 0}</td><td className="px-5 py-4">0</td></tr><tr><td className="px-5 py-4">Monthly paid budget</td><td className="px-5 py-4 font-black">${((settings?.maxEstimatedMonthlyCostCents ?? 0) / 100).toFixed(2)}</td><td className="px-5 py-4">$0.00</td></tr><tr><td className="px-5 py-4">Temporary metadata retention</td><td className="px-5 py-4 font-black">{settings?.retentionDays ?? 0} days</td><td className="px-5 py-4">30 days</td></tr></tbody></table></section>
      <section className="mt-8 grid gap-5 lg:grid-cols-3"><article className="rounded-2xl border border-white/10 p-5"><h2 className="font-black">Requests recorded</h2><p className="mt-2 text-3xl font-black">{monthlyRequests}</p><p className="mt-2 text-sm text-slate-400">Last 31 recorded UTC days.</p></article><article className="rounded-2xl border border-white/10 p-5"><h2 className="font-black">Estimated paid usage</h2><p className="mt-2 text-3xl font-black">${(monthlyCostMicros / 1_000_000).toFixed(4)}</p><p className="mt-2 text-sm text-slate-400">LLM calls remain disabled.</p></article><article className="rounded-2xl border border-white/10 p-5"><h2 className="font-black">Recommended starting cadence</h2><p className="mt-2 text-sm leading-6 text-slate-300">Tier 1 every 30–60 minutes, Tier 2 every 3 hours, Tier 3 twice daily, with a 100-request daily ceiling.</p></article></section>
    </div>
  );
}
