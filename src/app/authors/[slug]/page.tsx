import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CmsStoryCard } from "@/components/cms-story-card";
import { getPublicAuthor } from "@/lib/cms/public-queries";

type AuthorPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> { const author = await getPublicAuthor((await params).slug); return author ? { title: author.author.name, description: author.author.bio ?? `Articles by ${author.author.name}.`, alternates: { canonical: `/authors/${author.author.slug}` } } : {}; }

export default async function AuthorPage({ params }: AuthorPageProps) { const record = await getPublicAuthor((await params).slug); if (!record) notFound(); const { author } = record; const personSchema = author.name.endsWith('Staff') ? null : { '@context': 'https://schema.org', '@type': 'Person', name: author.name, description: author.bio, url: `/authors/${author.slug}`, sameAs: Object.values(author.socialLinks) }; return <main className="min-h-screen py-10 sm:py-14">{personSchema ? <script dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema).replace(/</g,'\\u003c') }} type="application/ld+json" /> : null}<div className="site-shell"><Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Authors' }, { label: author.name }]} /><header className="mt-10 max-w-3xl"><p className="eyebrow">Author</p><h1 className="mt-4 text-5xl font-black tracking-tight text-white">{author.name}</h1>{author.role ? <p className="mt-3 font-bold text-cyan-300">{author.role}</p> : null}{author.bio ? <p className="mt-5 text-lg leading-8 text-zinc-300">{author.bio}</p> : null}</header><section className="mt-12"><h2 className="text-3xl font-black text-white">Article history</h2><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{record.stories.map((story) => <CmsStoryCard key={story.id} story={story} />)}</div></section></div></main>; }
