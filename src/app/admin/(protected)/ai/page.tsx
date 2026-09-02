import Link from "next/link";

import { requireEditor } from "@/lib/auth/dal";
import { getAiAdminSummary } from "@/lib/ai/repository";

export default async function AiNewsroomPage() {
  const editor = await requireEditor();
  const summary = await getAiAdminSummary();
  const providerEnabled = summary.settings?.isEnabled && !summary.settings.emergencyStop && process.env.AI_PROVIDER_CONFIGURATION_APPROVED === "true";

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-200">Private editorial tooling</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">AI newsroom</h1>
      <p className="mt-3 max-w-3xl leading-7 text-slate-300">Phase 5A is manual-trigger only. AI material is evidence-bound, schema-validated, visibly labeled, and unable to approve, schedule, or publish a story.</p>

      {!summary.schemaReady ? (
        <section className="mt-8 rounded-3xl border border-amber-300/30 bg-amber-300/[0.06] p-6">
          <h2 className="font-black text-amber-100">Architecture ready · database migration pending</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">The additive Phase 5A migration has not been applied to this environment. This is the expected pre-approval state; no AI records or provider calls can be created.</p>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-sm text-slate-400">Provider</p><p className="mt-2 text-2xl font-black">{providerEnabled ? "ENABLED" : "OFF"}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-sm text-slate-400">Emergency stop</p><p className="mt-2 text-2xl font-black">{summary.settings?.emergencyStop ?? true ? "ON" : "OFF"}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-sm text-slate-400">Generations</p><p className="mt-2 text-2xl font-black">{summary.generations}</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-sm text-slate-400">Recorded cost</p><p className="mt-2 text-2xl font-black">${(summary.costMicros / 1_000_000).toFixed(4)}</p></article>
      </section>

      <section className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.035] p-6">
        <h2 className="text-xl font-black">Manual workflow</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">Open an eligible official-source candidate from Discovery, then request research, review every claim, generate a private draft, run grounding, and review SEO/video packages. The workflow stops at NEEDS REVIEW for human approval.</p>
        <Link className="mt-5 inline-flex min-h-11 items-center rounded-full border border-cyan-300/40 px-5 font-bold text-cyan-100" href="/admin/discovery" prefetch={false}>Choose a discovery candidate</Link>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 p-5"><h2 className="font-black">Role boundaries</h2><p className="mt-3 text-sm leading-6 text-slate-300">OWNER/ADMIN configure safeguards; EDITOR may manually generate and review; AUTHOR may edit assigned private drafts; FACT CHECKER reviews evidence and grounding. Anonymous and inactive users have no access.</p></article>
        <article className="rounded-2xl border border-white/10 p-5"><h2 className="font-black">Current access</h2><p className="mt-3 text-sm leading-6 text-slate-300">Signed in as {editor.displayName} · {editor.role.replaceAll("_", " ")}. Provider credentials are never stored in the newsroom tables.</p></article>
      </section>
    </div>
  );
}
