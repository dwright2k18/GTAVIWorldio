import Link from "next/link";

import { listAdminStories } from "@/lib/cms/admin-queries";

export default async function AdminStoriesPage() {
  const storyRows = await listAdminStories();

  return <div><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Content operations</p><h1 className="mt-2 text-4xl font-black">Stories</h1></div><Link className="min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950" href="/admin/stories/new">Create story</Link></div><div className="mt-8 overflow-x-auto rounded-3xl border border-white/10"><table className="min-w-full divide-y divide-white/10 text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">Story</th><th className="px-5 py-4">Workflow</th><th className="px-5 py-4">Verification</th><th className="px-5 py-4">Updated</th></tr></thead><tbody className="divide-y divide-white/10">{storyRows.map((story) => <tr key={story.id}><td className="px-5 py-4"><Link className="font-bold hover:text-cyan-300" href={`/admin/stories/${story.id}`}>{story.headline}</Link><p className="mt-1 text-xs text-slate-500">{story.urlPath} · {story.categoryName ?? "Unassigned"} · {story.authorName ?? "No author"}</p></td><td className="px-5 py-4 font-bold">{story.status.replaceAll('_',' ')}</td><td className="px-5 py-4">{story.verificationStatus.replaceAll('_',' ')}</td><td className="px-5 py-4 text-slate-400">{story.updatedAt.toLocaleString("en-US")}</td></tr>)}</tbody></table></div></div>;
}
