import { listSourcesWithUsage } from "@/lib/cms/admin-queries";

import { saveSource } from "./actions";

const input = "rounded-xl border border-white/15 bg-black/25 px-3 py-2.5";

function SourceForm({ source }: { source?: Awaited<ReturnType<typeof listSourcesWithUsage>>[number] }) {
  const action = saveSource.bind(null, source?.id ?? null);
  return <form action={action} className="grid gap-3 md:grid-cols-2"><input className={input} defaultValue={source?.name ?? ''} name="name" placeholder="Source name" required /><input className={input} defaultValue={source?.url ?? ''} name="url" placeholder="https://original-source.example/…" required type="url" /><select className={input} defaultValue={source?.sourceType ?? 'OTHER'} name="sourceType">{['FIRST_PARTY','PRESS_RELEASE','INVESTOR_REPORT','INTERVIEW','JOURNALISM','PUBLIC_RECORD','COMMUNITY_DISCOVERY','SOCIAL_POST','OTHER'].map((value) => <option key={value}>{value}</option>)}</select><input className={input} defaultValue={source?.publication ?? ''} name="publication" placeholder="Publication" /><input className={input} defaultValue={source?.authorName ?? ''} name="authorName" placeholder="Author / journalist" /><input className={input} defaultValue={source?.sourcePublishedAt?.toISOString().slice(0,16) ?? ''} name="sourcePublishedAt" type="datetime-local" /><textarea className={`${input} min-h-24`} defaultValue={source?.reliabilityNotes ?? ''} name="reliabilityNotes" placeholder="Reliability notes" /><textarea className={`${input} min-h-24`} defaultValue={source?.verificationNotes ?? ''} name="verificationNotes" placeholder="Verification notes" /><label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input defaultChecked={source?.isFirstParty ?? false} name="isFirstParty" type="checkbox" /> First-party source</label><button className="min-h-11 rounded-full bg-cyan-300 px-5 font-black text-slate-950" type="submit">{source ? 'Save source' : 'Add source'}</button></form>;
}

export default async function SourcesPage() {
  const rows = await listSourcesWithUsage();
  return <div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Evidence library</p><h1 className="mt-2 text-4xl font-black">Sources</h1><section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6"><h2 className="mb-5 text-xl font-black">Add original source</h2><SourceForm /></section><div className="mt-8 space-y-4">{rows.map((source) => <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={source.id}><summary className="cursor-pointer font-black">{source.name} <span className="ml-2 text-sm font-normal text-slate-400">{source.sourceType.replaceAll('_',' ')} · used by {source.usage} {source.usage === 1 ? 'story' : 'stories'}</span></summary><div className="mt-5"><SourceForm source={source} /></div></details>)}</div></div>;
}
