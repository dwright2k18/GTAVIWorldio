import { listAuthorsWithHistory } from "@/lib/cms/admin-queries";

import { saveAuthor } from "./actions";

const input = "rounded-xl border border-white/15 bg-black/25 px-3 py-2.5";

function AuthorForm({ author }: { author?: Awaited<ReturnType<typeof listAuthorsWithHistory>>[number] }) {
  const action = saveAuthor.bind(null, author?.id ?? null);
  const socialLinks = author ? Object.entries(author.socialLinks).map(([platform, url]) => `${platform}=${url}`).join('\n') : '';
  return <form action={action} className="grid gap-3 md:grid-cols-2"><input className={input} defaultValue={author?.name ?? ''} name="name" placeholder="Real name or approved staff byline" required /><input className={input} defaultValue={author?.slug ?? ''} name="slug" placeholder="Profile slug" /><input className={input} defaultValue={author?.role ?? ''} name="role" placeholder="Editorial role" /><input className={input} defaultValue={author?.expertiseAreas.join(', ') ?? ''} name="expertiseAreas" placeholder="Expertise, comma-separated" /><textarea className={`${input} min-h-28 md:col-span-2`} defaultValue={author?.bio ?? ''} name="bio" placeholder="Author bio" /><input className={input} defaultValue={author?.profileImageUrl ?? ''} name="profileImageUrl" placeholder="Approved profile image URL" type="url" /><input className={input} defaultValue={author?.profileImageAlt ?? ''} name="profileImageAlt" placeholder="Profile image alt text" /><textarea className={`${input} min-h-24 md:col-span-2`} defaultValue={socialLinks} name="socialLinks" placeholder={'platform=https://…\nplatform=https://…'} /><label><input defaultChecked={author?.isActive ?? true} name="isActive" type="checkbox" /> Active byline</label><button className="min-h-11 rounded-full bg-cyan-300 px-5 font-black text-slate-950">{author ? 'Save author' : 'Add author'}</button></form>;
}

export default async function AuthorsPage() {
  const rows = await listAuthorsWithHistory();
  return <div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Verified bylines</p><h1 className="mt-2 text-4xl font-black">Authors</h1><p className="mt-3 text-slate-300">Only real, approved credentials belong here. GTAVIWorldio Staff remains the safe generic byline.</p><section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6"><h2 className="mb-5 text-xl font-black">Add approved author</h2><AuthorForm /></section><div className="mt-8 space-y-4">{rows.map((author) => <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" key={author.id}><summary className="cursor-pointer font-black">{author.name} <span className="ml-2 text-sm font-normal text-slate-400">{author.role ?? 'Author'} · {author.storyCount} stories</span></summary><div className="mt-5"><AuthorForm author={author} /></div></details>)}</div></div>;
}
