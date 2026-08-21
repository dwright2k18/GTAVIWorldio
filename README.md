# GTA VI World

The source for an independent GTA VI news website, built with Next.js,
TypeScript, Tailwind CSS, and the App Router.

The current launch candidate includes a responsive editorial homepage, desktop and mobile navigation,
Latest filters, a 13-second Quick Hits interface, full article templates, local
search, a verification standards page, newsletter UI, structured data, robots,
sitemap, Open Graph artwork, and a custom 404 page.

## Getting Started

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The homepage lives in `src/app/page.tsx` and updates automatically during
development.

## Quality checks

```bash
pnpm lint
pnpm build
```

## Content architecture

Pre-launch editorial data lives in `src/data/content.ts`. Every story has a central
Story ID, verification status, primary source, publication dates, related
stories and videos, social distribution fields, and initial ranking metrics. The
model is intentionally database-ready without requiring a database for the MVP.

`EditorialMedia` accepts an approved image source, focal point, alt text, and
credit. `StoryArtwork` renders those sources through the optimized Next.js Image
component and falls back to the original gradient art when no approved asset is
available. Quick Hits accept an optional video source, poster, MIME type, and
caption track; videos never autoplay.

The newsletter component clearly identifies its inactive state and does not
store email addresses. Its submit handler is the provider integration point for
a later phase. The analytics module exposes typed, provider-neutral events but
does not connect a service, set cookies, or send data.

The site does not scrape game imagery or present invented announcements as
current news.

## Deploy on Vercel

Import the GitHub repository into Vercel. Vercel automatically detects the
Next.js framework, installs dependencies with pnpm, and uses `pnpm build`.

[Deploy this repository on Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdwright2k18%2FGTAVIWorldio)

No environment variables are required for preview deployments. Development and
preview builds default to `noindex` so pre-launch content cannot enter search
results accidentally.

Before a public production launch, complete editorial and legal approval, connect
a monitored contact route, confirm the canonical domain, and set:

```bash
NEXT_PUBLIC_SITE_URL=https://gtaviworld.io
NEXT_PUBLIC_SITE_INDEXABLE=true
```

The indexing flag is honored only when an explicit canonical site URL is also
configured.
