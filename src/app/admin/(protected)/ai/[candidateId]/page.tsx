import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";

import { aiPermissionDenial } from "@/lib/auth/ai-permissions";
import { requireEditor } from "@/lib/auth/dal";
import { getAiCandidateWorkspace } from "@/lib/ai/repository";
import { getDiscoveryCandidate } from "@/lib/discovery/admin-queries";

import { cancelAiGeneration, editAiArticleDraft, generateAiArtifact, reviewAiClaim, reviewAiDraft, runAiGrounding } from "../actions";

const artifactButtons = [
  ["RESEARCH_PACKET", "Generate Research Packet"],
  ["ARTICLE_DRAFT", "Generate Article Draft"],
  ["SEO_PACKAGE", "Generate SEO Package"],
  ["PRIMARY_VIDEO", "Generate Primary Video Package"],
  ["QUICK_HIT", "Generate 13-second Quick Hit"],
] as const;

const fieldClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none focus:border-cyan-300";

export default async function CandidateAiWorkspace({ params }: { params: Promise<{ candidateId: string }> }) {
  const editor = await requireEditor();
  const { candidateId } = await params;
  const discovery = await getDiscoveryCandidate(candidateId, editor);
  if (!discovery) notFound();
  const workspace = await getAiCandidateWorkspace(candidateId);
  const providerApproved = process.env.AI_PROVIDER_CONFIGURATION_APPROVED === "true";
  const canGenerate = workspace.schemaReady && providerApproved && Boolean(workspace.settings?.isEnabled) && !workspace.settings?.emergencyStop && aiPermissionDenial(editor.role, "GENERATE_RESEARCH") === null;
  const canReviewClaims = aiPermissionDenial(editor.role, "REVIEW_CLAIM") === null;
  const canGround = aiPermissionDenial(editor.role, "RUN_GROUNDING") === null;
  const latestDraft = workspace.drafts[0];
  const canEditDraft = latestDraft && aiPermissionDenial(editor.role, "EDIT_ASSIGNED_DRAFT", { assigned: discovery.candidate.assignedTo === editor.id }) === null;
  const totalTokens = workspace.costs.reduce((sum, cost) => sum + cost.inputTokens + cost.outputTokens, 0);
  const totalCost = workspace.costs.reduce((sum, cost) => sum + cost.costMicros, 0);

  return (
    <div>
      <Link className="text-sm font-bold text-cyan-300" href={`/admin/discovery/${candidateId}`} prefetch={false}>← Candidate evidence</Link>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-200">AI draft material · private</p>
      <h1 className="mt-2 max-w-5xl text-4xl font-black tracking-tight">{discovery.candidate.title}</h1>
      <p className="mt-3 max-w-4xl text-slate-300">Nothing on this page is approved public copy. Manual generation requires an eligible official source, reviewed evidence, an approved provider, and available budgets.</p>

      {!workspace.schemaReady ? <section className="mt-8 rounded-3xl border border-amber-300/30 bg-amber-300/[0.06] p-5 text-sm leading-6 text-amber-50">Phase 5A migration is pending in this environment. Controls are shown in their fail-closed state and cannot call a provider.</section> : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 p-5"><p className="text-sm text-slate-400">Research packets</p><p className="mt-2 text-3xl font-black">{workspace.packets.length}</p></article>
        <article className="rounded-2xl border border-white/10 p-5"><p className="text-sm text-slate-400">Private drafts</p><p className="mt-2 text-3xl font-black">{workspace.drafts.length}</p></article>
        <article className="rounded-2xl border border-white/10 p-5"><p className="text-sm text-slate-400">Tokens</p><p className="mt-2 text-3xl font-black">{totalTokens.toLocaleString("en-US")}</p></article>
        <article className="rounded-2xl border border-white/10 p-5"><p className="text-sm text-slate-400">Cost</p><p className="mt-2 text-3xl font-black">${(totalCost / 1_000_000).toFixed(4)}</p></article>
      </section>

      <section className="mt-8 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/[0.035] p-5 sm:p-7">
        <h2 className="text-xl font-black">Manual AI controls</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Provider {workspace.settings?.isEnabled && providerApproved ? "configured" : "OFF"}; emergency stop {workspace.settings?.emergencyStop ?? true ? "ON" : "OFF"}; all budget limits default to zero.</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {artifactButtons.map(([kind, label]) => <form action={generateAiArtifact} className="rounded-2xl border border-white/10 bg-black/20 p-4" key={kind}><input name="candidateId" type="hidden" value={candidateId} /><input name="kind" type="hidden" value={kind} /><input name="idempotencyKey" type="hidden" value={randomUUID()} /><label className="text-sm font-bold">Editorial reason<textarea className={`${fieldClass} min-h-20`} defaultValue={`Manual ${label.toLowerCase()} request for evidence-grounded editorial review.`} name="reason" required /></label><button className="mt-3 min-h-11 w-full rounded-full border border-fuchsia-300/40 px-4 font-bold text-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canGenerate} type="submit">{label}</button></form>)}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 p-5 sm:p-7">
        <h2 className="text-xl font-black">Claim review</h2>
        {workspace.claims.length ? <div className="mt-5 space-y-4">{workspace.claims.map((claim) => <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4" key={claim.id}><p className="text-xs font-black uppercase tracking-wider text-cyan-300">{claim.reviewStatus.replaceAll("_", " ")} · {claim.confidence}%</p><p className="mt-2 leading-7">{claim.claimText}</p><p className="mt-2 break-all text-xs text-slate-500">Evidence: {claim.evidenceRecordIds.join(", ")}</p>{canReviewClaims ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{(["APPROVED", "REJECTED"] as const).map((status) => <form action={reviewAiClaim} key={status}><input name="claimId" type="hidden" value={claim.id} /><input name="candidateId" type="hidden" value={candidateId} /><input name="reviewStatus" type="hidden" value={status} /><input className={fieldClass} name="reason" placeholder="Document the evidence decision" required /><button className="mt-2 min-h-11 w-full rounded-full border border-white/15 font-bold" type="submit">{status === "APPROVED" ? "Approve claim" : "Reject claim"}</button></form>)}</div> : null}</article>)}</div> : <p className="mt-4 text-sm text-slate-400">No generated claims. A research packet must be generated and validated first.</p>}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 p-5"><h2 className="font-black">Grounding validation</h2><p className="mt-2 text-sm leading-6 text-slate-400">Checks evidence IDs, claim approval, contradictions, quotes, dates, sensitive GTA VI assertions, and verification strength.</p>{latestDraft && canGround ? <form action={runAiGrounding} className="mt-4"><input name="draftId" type="hidden" value={latestDraft.id} /><input name="candidateId" type="hidden" value={candidateId} /><button className="min-h-11 rounded-full border border-cyan-300/40 px-5 font-bold text-cyan-100" type="submit">Run Grounding Validation</button></form> : null}</article>
        <article className="rounded-3xl border border-white/10 p-5"><h2 className="font-black">Review queue</h2><p className="mt-2 text-sm leading-6 text-slate-400">SEO packages: {workspace.seo.length} · Primary/Quick Hit packages: {workspace.packages.length}. Editors can request revision, send to fact check, mark needs review only after grounding, or reject output. AI can never advance beyond NEEDS REVIEW.</p></article>
      </section>

      {latestDraft ? <section className="mt-8 rounded-3xl border border-white/10 p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-wider text-fuchsia-200">Private article draft · {latestDraft.status.replaceAll("_", " ")}</p><h2 className="mt-2 text-xl font-black">Human edit and disposition</h2><p className="mt-2 text-sm leading-6 text-slate-400">The provider output remains preserved in generation history. Editing resets grounding and cannot change a public story.</p>{canEditDraft ? <form action={editAiArticleDraft} className="mt-5"><input name="draftId" type="hidden" value={latestDraft.id} /><input name="candidateId" type="hidden" value={candidateId} /><label className="text-sm font-bold">Structured private draft JSON<textarea className={`${fieldClass} min-h-72 font-mono text-xs leading-5`} defaultValue={JSON.stringify(latestDraft.draft, null, 2)} name="draftJson" required /></label><label className="mt-3 block text-sm font-bold">Edit reason<input className={fieldClass} defaultValue="Human editorial revision of private AI draft material." name="reason" required /></label><button className="mt-3 min-h-11 rounded-full border border-cyan-300/40 px-5 font-bold text-cyan-100" type="submit">Save private revision</button></form> : null}<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([['DRAFTING', 'Request revision'], ['FACT_CHECK', 'Send to fact check'], ['NEEDS_REVIEW', 'Mark needs review'], ['APPROVED', 'Approve private draft'], ['REJECTED', 'Reject']] as const).map(([nextStatus, label]) => <form action={reviewAiDraft} key={nextStatus}><input name="draftId" type="hidden" value={latestDraft.id} /><input name="candidateId" type="hidden" value={candidateId} /><input name="nextStatus" type="hidden" value={nextStatus} /><input name="reason" type="hidden" value={`Human editorial disposition: ${label.toLowerCase()}.`} /><button className="min-h-11 w-full rounded-full border border-white/15 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40" disabled={nextStatus === latestDraft.status || (nextStatus === 'APPROVED' && !['OWNER', 'ADMIN', 'EDITOR'].includes(editor.role))} type="submit">{label}</button></form>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">APPROVED here means approved private newsroom material only. This architecture exposes no schedule or publish action.</p></section> : null}

      <section className="mt-8 rounded-3xl border border-white/10 p-5 sm:p-7"><h2 className="text-xl font-black">Generation and audit history</h2>{workspace.generations.length ? <ol className="mt-5 space-y-3">{workspace.generations.map((generation) => <li className="rounded-2xl border border-white/10 p-4" key={generation.id}><div className="flex flex-wrap justify-between gap-3"><p className="font-black">{generation.kind.replaceAll("_", " ")} · {generation.status}</p><time className="text-xs text-slate-500">{generation.createdAt.toLocaleString("en-US")}</time></div><p className="mt-2 text-xs text-slate-400">{generation.providerCode ?? "No provider"} · {generation.modelId ?? "No model"} · {generation.inputTokens + generation.outputTokens} tokens</p>{["REQUESTED", "RUNNING"].includes(generation.status) ? <form action={cancelAiGeneration} className="mt-3"><input name="generationId" type="hidden" value={generation.id} /><input name="candidateId" type="hidden" value={candidateId} /><input name="reason" type="hidden" value="Manual cancellation requested from the AI newsroom." /><button className="min-h-10 rounded-full border border-rose-300/40 px-4 text-sm font-bold text-rose-100" type="submit">Cancel generation</button></form> : null}</li>)}</ol> : <p className="mt-4 text-sm text-slate-400">No AI calls or deterministic generation records exist for this candidate.</p>}</section>
    </div>
  );
}
