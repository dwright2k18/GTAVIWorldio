import { requireEditor } from "@/lib/auth/dal";
import { listDiscoverySources } from "@/lib/discovery/admin-queries";

import { saveMonitoredSource } from "./actions";

const inputClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base text-white outline-none focus:border-cyan-300";
const labelClass = "block text-sm font-bold text-slate-200";

function SourceForm({ source }: { source?: Awaited<ReturnType<typeof listDiscoverySources>>[number] }) {
  const action = saveMonitoredSource.bind(null, source?.id ?? null);
  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      <label className={`${labelClass} lg:col-span-2`}>Name<input className={inputClass} defaultValue={source?.name ?? ""} name="name" required /></label>
      <label className={labelClass}>Authority tier<select className={inputClass} defaultValue={source?.authorityTier ?? "TIER_2"} name="authorityTier">{["TIER_1", "TIER_2", "TIER_3", "TIER_4"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={`${labelClass} lg:col-span-2`}>Public source URL<input className={inputClass} defaultValue={source?.url ?? ""} name="url" required type="url" /></label>
      <label className={labelClass}>Source type<select className={inputClass} defaultValue={source?.sourceType ?? "JOURNALISM"} name="sourceType">{["FIRST_PARTY", "PRESS_RELEASE", "INVESTOR_REPORT", "INTERVIEW", "JOURNALISM", "PUBLIC_RECORD", "COMMUNITY_DISCOVERY", "SOCIAL_POST", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={labelClass}>Connector<select className={inputClass} defaultValue={source?.connectorKind ?? "MANUAL"} name="connectorKind">{["RSS", "ATOM", "HTML_LISTING", "HTML_CHANGE", "JSON_FEED", "MANUAL"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={labelClass}>Reliability score<input className={inputClass} defaultValue={source?.reliabilityScore ?? 50} max={100} min={0} name="reliabilityScore" type="number" /></label>
      <label className={labelClass}>Requests per hour<input className={inputClass} defaultValue={source?.rateLimitPerHour ?? 2} max={120} min={1} name="rateLimitPerHour" type="number" /></label>
      <label className={labelClass}>Minimum interval (minutes)<input className={inputClass} defaultValue={source?.minCheckIntervalMinutes ?? 180} max={10080} min={5} name="minCheckIntervalMinutes" type="number" /></label>
      <label className={`${labelClass} lg:col-span-2`}>Connector configuration<textarea className={`${inputClass} min-h-28 font-mono text-sm`} defaultValue={JSON.stringify(source?.connectorConfig ?? {}, null, 2)} name="connectorConfig" /></label>
      <label className={labelClass}>Historical accuracy notes<textarea className={`${inputClass} min-h-28`} defaultValue={source?.historicalAccuracyNotes ?? ""} name="historicalAccuracyNotes" /></label>
      <label className={`${labelClass} lg:col-span-2`}>Terms and policy notes<textarea className={`${inputClass} min-h-28`} defaultValue={source?.termsPolicyNotes ?? ""} name="termsPolicyNotes" /></label>
      <div className="flex flex-wrap gap-4 lg:col-span-3">
        <label className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-bold"><input defaultChecked={source?.isFirstParty ?? false} name="isFirstParty" type="checkbox" /> First party</label>
        <label className="flex min-h-11 items-center gap-2 rounded-full border border-amber-300/30 px-4 text-sm font-bold text-amber-100"><input defaultChecked={source?.isActive ?? false} name="isActive" type="checkbox" /> Eligible for future monitoring</label>
      </div>
      <p className="text-sm leading-6 text-slate-400 lg:col-span-2">Source activation only marks eligibility. Recurring monitoring and automatic drafting remain independently disabled.</p>
      <button className="min-h-11 rounded-full bg-cyan-300 px-5 font-black text-slate-950" type="submit">{source ? "Save source" : "Add inactive source"}</button>
    </form>
  );
}

export default async function DiscoverySourcesPage() {
  const editor = await requireEditor(["OWNER", "ADMIN", "EDITOR"]);
  const canManage = editor.role === "OWNER" || editor.role === "ADMIN";
  const rows = await listDiscoverySources();
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Monitoring registry</p>
      <h1 className="mt-2 text-4xl font-black">Discovery sources</h1>
      <p className="mt-3 max-w-3xl text-slate-300">All sources begin inactive. Authority scores are decision aids, and every discovery still requires evidence review.</p>
      {canManage ? <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7"><h2 className="mb-5 text-xl font-black">Add source</h2><SourceForm /></section> : <p className="mt-8 rounded-2xl border border-white/10 p-5 text-sm text-slate-300">Source settings are read-only for editors. Owners and administrators manage the registry.</p>}
      <div className="mt-8 space-y-4">
        {rows.map((source) => (
          <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={source.id}>
            <summary className="cursor-pointer font-black">{source.name} <span className="ml-2 text-sm font-normal text-slate-400">{source.authorityTier.replace("_", " ")} · {source.healthStatus.replaceAll("_", " ")} · {source.isActive ? "eligible" : "inactive"}</span></summary>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400"><span>{source.domain}</span><span>{source.connectorKind.replaceAll("_", " ")}</span><span>Reliability {source.reliabilityScore}/100</span><span>{source.lastRun ? `Last test ${source.lastRun.startedAt.toLocaleString("en-US")}` : "Never fetched"}</span></div>
            {canManage ? <div className="mt-6"><SourceForm source={source} /></div> : null}
          </details>
        ))}
      </div>
    </div>
  );
}
