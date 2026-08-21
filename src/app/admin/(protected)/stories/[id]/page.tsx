import { notFound } from "next/navigation";

import { StoryForm } from "@/components/admin/story-form";
import { getAdminStory, getStoryFormOptions } from "@/lib/cms/admin-queries";

import { addCorrection, updateStory } from "../actions";

type StoryEditorPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; correction?: string }>;
};

export default async function StoryEditorPage({ params, searchParams }: StoryEditorPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const options = await getStoryFormOptions();
  const record = await getAdminStory(id);

  if (!record) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            {record.story.status.replaceAll("_", " ")}
          </p>
          <h1 className="mt-2 max-w-5xl text-4xl font-black">{record.story.headline}</h1>
        </div>
        <p className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">Story ID · {id}</p>
      </div>

      {query.saved ? (
        <p className="my-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-emerald-100">
          Story saved and its revision history was updated.
        </p>
      ) : null}
      {query.correction ? (
        <p className="my-6 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-cyan-100">
          Correction record added.
        </p>
      ) : null}

      <div className="mt-8">
        <StoryForm action={updateStory} options={options} record={record} />
      </div>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <h2 className="text-2xl font-black">Corrections</h2>
        <form action={addCorrection} className="mt-5 grid gap-4 lg:grid-cols-2">
          <input name="storyId" type="hidden" value={id} />
          <label className="text-sm font-bold">
            Original issue
            <textarea
              className="mt-2 min-h-28 w-full rounded-xl border border-white/15 bg-black/25 p-4"
              name="originalIssue"
              required
            />
          </label>
          <label className="text-sm font-bold">
            Correction
            <textarea
              className="mt-2 min-h-28 w-full rounded-xl border border-white/15 bg-black/25 p-4"
              name="correction"
              required
            />
          </label>
          <select className="rounded-xl border border-white/15 bg-black/25 p-3" name="significance">
            <option value="NON_MATERIAL">Non-material</option>
            <option value="MATERIAL">Material</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input name="isPublic" type="checkbox" /> Display to readers when the story is live
          </label>
          <button className="min-h-11 rounded-full border border-cyan-300/40 px-5 font-bold lg:col-span-2" type="submit">
            Add correction record
          </button>
        </form>
        {record.corrections.length ? (
          <ul className="mt-6 space-y-4">
            {record.corrections.map((correction) => (
              <li className="rounded-xl border border-white/10 p-4" key={correction.id}>
                <p className="font-bold">
                  {correction.significance.replace("_", " ")} · {correction.correctedAt.toLocaleString("en-US")}
                </p>
                <p className="mt-2 text-sm text-slate-300">{correction.correction}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-slate-400">No corrections recorded.</p>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <h2 className="text-2xl font-black">Revision history</h2>
        {record.revisions.length ? (
          <ol className="mt-5 space-y-4">
            {record.revisions.map((revision) => (
              <li className="rounded-xl border border-white/10 p-4" key={revision.id}>
                <p className="font-bold">
                  Revision {revision.revisionNumber} · {revision.createdAt.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {revision.fieldsChanged.join(", ")}
                  {revision.changeReason ? ` · ${revision.changeReason}` : ""}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 text-slate-400">No edits have been recorded since migration.</p>
        )}
      </section>
    </div>
  );
}
