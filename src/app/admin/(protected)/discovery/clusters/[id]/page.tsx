import Link from "next/link";
import { notFound } from "next/navigation";

import { ScorePill } from "@/components/admin/score-pill";
import { requireEditor } from "@/lib/auth/dal";
import { getStoryCluster } from "@/lib/discovery/admin-queries";

export default async function StoryClusterPage({ params }: { params: Promise<{ id: string }> }) {
  const editor = await requireEditor();
  const { id } = await params;
  const record = await getStoryCluster(id, editor);
  if (!record) notFound();
  return <div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Story cluster · {record.cluster.status}</p><h1 className="mt-2 text-4xl font-black">{record.cluster.title}</h1><p className="mt-3 max-w-4xl text-slate-300">{record.cluster.primaryEvent}</p><div className="mt-5"><ScorePill label="Confidence" score={record.cluster.confidenceScore} /></div>{record.cluster.conflictingClaims.length ? <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.04] p-6"><h2 className="text-xl font-black">Conflicting claims</h2><pre className="mt-4 whitespace-pre-wrap text-sm text-amber-100">{JSON.stringify(record.cluster.conflictingClaims, null, 2)}</pre></section> : null}<section className="mt-8"><h2 className="text-2xl font-black">Source timeline</h2><ol className="mt-5 space-y-4">{record.candidates.map(({ candidate, sourceName, sourceTier }) => <li className="rounded-2xl border border-white/10 bg-white/[0.035] p-5" key={candidate.id}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-cyan-300">{sourceTier.replace("_", " ")} · {sourceName}</p><Link className="mt-2 block text-lg font-black hover:text-cyan-300" href={`/admin/discovery/${candidate.id}`}>{candidate.title}</Link></div><time className="text-sm text-slate-500">{(candidate.sourcePublishedAt ?? candidate.discoveredAt).toLocaleString("en-US")}</time></div><p className="mt-3 text-sm text-slate-400">{candidate.verificationRecommendation.replaceAll("_", " ")} · Confidence {candidate.confidenceScore} · {candidate.status.replaceAll("_", " ")}</p></li>)}</ol></section></div>;
}
