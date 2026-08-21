import { StoryForm } from "@/components/admin/story-form";
import { getStoryFormOptions } from "@/lib/cms/admin-queries";

import { createStory } from "../actions";

export default async function NewStoryPage() {
  const options = await getStoryFormOptions();
  return <div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">New CMS record</p><h1 className="mt-2 text-4xl font-black">Create story</h1><p className="mt-3 mb-8 text-slate-300">New records begin inside the editorial workflow and are never public by default.</p><StoryForm action={createStory} options={options} /></div>;
}
