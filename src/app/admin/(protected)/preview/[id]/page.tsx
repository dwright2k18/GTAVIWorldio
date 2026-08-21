import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/article-body";
import { VerificationBadge } from "@/components/verification-badge";
import { getAdminStory } from "@/lib/cms/admin-queries";

export const metadata: Metadata = {
  title: "Secure draft preview",
  alternates: { canonical: null },
  robots: { index: false, follow: false, nocache: true },
};

type PreviewPageProps = { params: Promise<{ id: string }> };

export default async function DraftPreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const record = await getAdminStory(id);
  if (!record) notFound();
  const { story } = record;

  const publicCorrections = record.corrections.filter((correction) => correction.isPublic);

  return (
    <article className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
        <strong>Secure preview:</strong> this {story.status.replaceAll("_", " ").toLowerCase()} record is not public,
        searchable, or listed in the sitemap.
      </div>
      <nav className="mt-6">
        <Link className="font-bold text-cyan-300" href={`/admin/stories/${id}`} prefetch={false}>
          ← Return to editor
        </Link>
      </nav>
      <header className="py-10">
        <VerificationBadge
          status={story.verificationStatus.replaceAll("_", " ") as Parameters<typeof VerificationBadge>[0]["status"]}
        />
        <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
          {record.categoryName ?? story.contentType} · {story.status.replaceAll("_", " ")}
        </p>
        <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">{story.headline}</h1>
        {story.subtitle ? <p className="mt-5 text-xl text-slate-300">{story.subtitle}</p> : null}
        <p className="mt-6 border-l-4 border-fuchsia-400 pl-5 text-xl leading-8 text-slate-200">{story.summary}</p>
        <p className="mt-6 text-sm text-slate-400">
          By {record.authorName ?? "Unassigned"} · Source: {record.sourceName ?? "Unassigned"}
        </p>
      </header>
      <ArticleBody blocks={story.body} />
      {publicCorrections.length ? (
        <aside className="mt-12 rounded-2xl border border-white/10 p-6">
          <h2 className="text-xl font-black">Corrections</h2>
          {publicCorrections.map((correction) => (
            <p className="mt-3 text-sm text-slate-300" key={correction.id}>
              {correction.correction}
            </p>
          ))}
        </aside>
      ) : null}
    </article>
  );
}
