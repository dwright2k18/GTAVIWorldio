import Link from "next/link";

import type { getAdminStory, getStoryFormOptions } from "@/lib/cms/admin-queries";
import { articleBlocksToText } from "@/lib/cms/content";
import { defaultNewsroomTimeZone, formatDateTimeInZone } from "@/lib/cms/datetime";

type StoryRecord = NonNullable<Awaited<ReturnType<typeof getAdminStory>>>;
type StoryOptions = Awaited<ReturnType<typeof getStoryFormOptions>>;

type StoryFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  options: StoryOptions;
  record?: StoryRecord;
};

const fieldClass =
  "mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300";
const labelClass = "block text-sm font-bold text-slate-200";

function MultiSelect({
  label,
  name,
  values,
  options,
}: {
  label: string;
  name: string;
  values: string[];
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select className={`${fieldClass} min-h-36`} defaultValue={values} multiple name={name}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs font-normal text-slate-400">
        Use Ctrl or Command to select more than one.
      </span>
    </label>
  );
}

export function StoryForm({ action, options, record }: StoryFormProps) {
  const story = record?.story;
  const selectedTags = record?.tagIds ?? [];
  const selectedSources = record?.sourceRecords.map(({ source }) => source.id) ?? [];
  const selectedRelatedStories = record?.relatedStoryIds ?? [];
  const selectedVideos = record?.relatedVideoIds ?? [];
  const selectedEvergreen = record?.evergreenPageIds ?? [];

  return (
    <form action={action} className="space-y-7">
      {story ? <input name="storyId" type="hidden" value={story.id} /> : null}
      <section className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-black">Editorial content</h2>
          <p className="mt-1 text-sm text-slate-400">Headline defaults feed the SEO title, slug, social title, breadcrumbs, schema, and internal search.</p>
        </div>
        <label className={`${labelClass} lg:col-span-2`}>
          Headline
          <input className={fieldClass} defaultValue={story?.headline ?? ""} maxLength={180} name="headline" required />
        </label>
        <label className={labelClass}>
          Slug override
          <input className={fieldClass} defaultValue={story?.slug ?? ""} maxLength={90} name="slug" placeholder="Derived from headline when blank" />
        </label>
        <label className={labelClass}>
          Subtitle
          <input className={fieldClass} defaultValue={story?.subtitle ?? ""} name="subtitle" />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Summary
          <textarea className={`${fieldClass} min-h-28`} defaultValue={story?.summary ?? ""} maxLength={500} name="summary" required />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Article body
          <textarea
            className={`${fieldClass} min-h-[32rem] font-mono text-sm leading-7`}
            defaultValue={story ? articleBlocksToText(story.body) : ""}
            name="bodyText"
            placeholder={"Answer the core question early.\n\n## Use H2 sections\n\n### Use H3 subsections\n\n- Lists remain semantic"}
          />
          <span className="mt-2 block text-xs font-normal text-slate-400">Blank lines create paragraphs. Prefix headings with ## or ###, quotes with &gt;, and list items with -.</span>
        </label>
      </section>

      <section className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7 lg:grid-cols-3">
        <div className="lg:col-span-3"><h2 className="text-xl font-black">Classification and verification</h2></div>
        <label className={labelClass}>
          Content type
          <select className={fieldClass} defaultValue={story?.contentType ?? "NEWS"} name="contentType">
            {['NEWS','FEATURE','ANALYSIS','GUIDE','EVERGREEN','VIDEO'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Category
          <select className={fieldClass} defaultValue={story?.categoryId ?? ""} name="categoryId">
            <option value="">Unassigned</option>
            {options.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Subcategory
          <input className={fieldClass} defaultValue={story?.subcategory ?? ""} name="subcategory" />
        </label>
        <label className={labelClass}>
          Verification status
          <select className={fieldClass} defaultValue={story?.verificationStatus ?? "SPECULATION"} name="verificationStatus">
            {['CONFIRMED','CREDIBLE_REPORT','RUMOR','SPECULATION','ALLEGED_LEAK'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Author
          <select className={fieldClass} defaultValue={story?.authorId ?? ""} name="authorId">
            <option value="">Unassigned</option>
            {options.authors.map((author) => <option key={author.id} value={author.id}>{author.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Primary source
          <select className={fieldClass} defaultValue={story?.primarySourceId ?? ""} name="primarySourceId">
            <option value="">Unassigned</option>
            {options.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
        </label>
        <MultiSelect
          label="All supporting sources"
          name="sourceIds"
          values={selectedSources}
          options={options.sources.map((source) => ({ id: source.id, label: source.name }))}
        />
        <label className={labelClass}>
          Original source publication date
          <input className={fieldClass} defaultValue={formatDateTimeInZone(story?.originalSourcePublishedAt)} name="originalSourcePublishedAt" type="datetime-local" />
        </label>
        <label className={labelClass}>
          Scheduled publication (entered in newsroom timezone; stored in UTC)
          <input className={fieldClass} defaultValue={formatDateTimeInZone(story?.scheduledFor, story?.scheduledTimezone ?? defaultNewsroomTimeZone)} name="scheduledFor" type="datetime-local" />
        </label>
        <label className={labelClass}>
          Entered newsroom timezone
          <input className={fieldClass} defaultValue={story?.scheduledTimezone ?? defaultNewsroomTimeZone} name="scheduledTimezone" />
        </label>
        <label className={labelClass}>
          Last reviewed
          <input className={fieldClass} defaultValue={formatDateTimeInZone(story?.lastReviewedAt)} name="lastReviewedAt" type="datetime-local" />
        </label>
        <MultiSelect label="Tags" name="tagIds" values={selectedTags} options={options.tags.map((tag) => ({ id: tag.id, label: tag.name }))} />
      </section>

      <section className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7 lg:grid-cols-2">
        <div className="lg:col-span-2"><h2 className="text-xl font-black">Media and distribution</h2><p className="mt-1 text-sm text-slate-400">Only approved, licensed, or original assets should be entered.</p></div>
        <label className={labelClass}>
          Hero image asset
          <select className={fieldClass} defaultValue={story?.heroMediaId ?? ""} name="heroMediaId">
            <option value="">No approved asset</option>
            {options.media.map((media) => <option key={media.id} value={media.id}>{media.altText ?? media.url}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Open Graph image asset
          <select className={fieldClass} defaultValue={story?.openGraphImageId ?? ""} name="openGraphImageId">
            <option value="">Use hero/site default</option>
            {options.media.map((media) => <option key={media.id} value={media.id}>{media.altText ?? media.url}</option>)}
          </select>
        </label>
        <label className={labelClass}>Hero alt text<input className={fieldClass} defaultValue={story?.heroImageAlt ?? ""} name="heroImageAlt" /></label>
        <label className={labelClass}>Hero caption<input className={fieldClass} defaultValue={story?.heroImageCaption ?? ""} name="heroImageCaption" /></label>
        <label className={labelClass}>Hero credit<input className={fieldClass} defaultValue={story?.heroImageCredit ?? ""} name="heroImageCredit" /></label>
        {(['tiktokUrl','youtubeUrl','instagramUrl','facebookUrl'] as const).map((name) => (
          <label className={labelClass} key={name}>{name.replace('Url',' URL')}<input className={fieldClass} defaultValue={story?.[name] ?? ""} name={name} type="url" /></label>
        ))}
        <div className="flex flex-wrap gap-4 lg:col-span-2">
          {([
            ['featured','Featured'],['breaking','Breaking'],['evergreen','Evergreen'],['trendingEligible','Trending eligible'],
          ] as const).map(([name, label]) => (
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-bold" key={name}>
              <input defaultChecked={story?.[name] ?? false} name={name} type="checkbox" /> {label}
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7 lg:grid-cols-2">
        <div className="lg:col-span-2"><h2 className="text-xl font-black">SEO and social metadata</h2><p className="mt-1 text-sm text-slate-400">Leave overrides blank to use the headline and summary defaults.</p></div>
        <label className={labelClass}>SEO title override<input className={fieldClass} defaultValue={story?.seoTitleOverride ?? ""} name="seoTitleOverride" /></label>
        <label className={labelClass}>Canonical override<input className={fieldClass} defaultValue={story?.canonicalOverride ?? ""} name="canonicalOverride" type="url" /></label>
        <label className={`${labelClass} lg:col-span-2`}>Meta description override<textarea className={`${fieldClass} min-h-24`} defaultValue={story?.metaDescriptionOverride ?? ""} name="metaDescriptionOverride" /></label>
        <label className={labelClass}>Open Graph title override<input className={fieldClass} defaultValue={story?.openGraphTitleOverride ?? ""} name="openGraphTitleOverride" /></label>
        <label className={labelClass}>Open Graph description override<input className={fieldClass} defaultValue={story?.openGraphDescriptionOverride ?? ""} name="openGraphDescriptionOverride" /></label>
        <label className={labelClass}>
          Robots override
          <select className={fieldClass} defaultValue={story?.robotsOverride ?? ""} name="robotsOverride">
            <option value="">Use site default</option>
            <option value="noindex,nofollow">noindex, nofollow</option>
            <option value="index,follow">index, follow (still blocked globally pre-launch)</option>
          </select>
        </label>
      </section>

      <section className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7 lg:grid-cols-2">
        <div className="lg:col-span-2"><h2 className="text-xl font-black">Discovery relationships</h2></div>
        <MultiSelect label="Related stories" name="relatedStoryIds" values={selectedRelatedStories} options={options.stories.filter((option) => option.id !== story?.id).map((option) => ({ id: option.id, label: `${option.headline} · ${option.status.replaceAll('_',' ')}` }))} />
        <MultiSelect label="Related videos and Quick Hits" name="relatedVideoIds" values={selectedVideos} options={options.videos.map((option) => ({ id: option.id, label: `${option.title} · ${option.kind.replaceAll('_',' ')}` }))} />
        <MultiSelect label="Evergreen hubs" name="evergreenPageIds" values={selectedEvergreen} options={options.evergreenPages.map((option) => ({ id: option.id, label: `${option.title} · ${option.path}` }))} />
        <label className={labelClass}>Internal notes<textarea className={`${fieldClass} min-h-36`} defaultValue={story?.internalNotes ?? ""} name="internalNotes" /><span className="mt-2 block text-xs font-normal text-slate-400">Never displayed publicly.</span></label>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-2xl border border-white/15 bg-[#0b1222]/95 p-4 shadow-2xl backdrop-blur">
        <button className="min-h-11 rounded-full bg-white px-5 font-black text-slate-950" name="intent" type="submit" value="save">Save draft</button>
        <button className="min-h-11 rounded-full border border-white/20 px-5 font-bold" name="intent" type="submit" value="review">Send to review</button>
        <button className="min-h-11 rounded-full border border-amber-300/40 px-5 font-bold text-amber-100" name="intent" type="submit" value="fact-check">Fact check</button>
        <button className="min-h-11 rounded-full border border-cyan-300/50 px-5 font-bold text-cyan-200" name="intent" type="submit" value="approve">Approve</button>
        <button className="min-h-11 rounded-full border border-fuchsia-300/50 px-5 font-bold text-fuchsia-200" name="intent" type="submit" value="schedule">Schedule</button>
        <button className="min-h-11 rounded-full bg-emerald-300 px-5 font-black text-slate-950" name="intent" type="submit" value="publish">Publish</button>
        {record ? <Link className="min-h-11 rounded-full border border-white/20 px-5 py-2.5 font-bold" href={`/admin/preview/${story?.id}`} prefetch={false}>Secure preview</Link> : null}
        {record ? <button className="min-h-11 rounded-full border border-rose-300/40 px-5 font-bold text-rose-100" name="intent" type="submit" value="archive">Archive</button> : null}
      </div>
    </form>
  );
}
