# GTA VI World

The source for an independent GTA VI news website, built with Next.js,
TypeScript, Tailwind CSS, and the App Router.

Phase 1 includes a responsive editorial homepage, mobile navigation, Latest
filters, a 13-second Quick Hits interface, full article templates, local search,
verification labels, structured data, robots, sitemap, Open Graph artwork, and
a custom 404 page.

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

Sample editorial data lives in `src/data/content.ts`. Every story has a central
Story ID, verification status, primary source, publication dates, related
stories and videos, social distribution fields, and placeholder metrics. The
model is intentionally database-ready without requiring a database for the MVP.

All sample content and original placeholder artwork are labeled in the UI. The
site does not use scraped game imagery or present invented announcements as
current news.

## Deploy on Vercel

Import the GitHub repository into Vercel. Vercel automatically detects the
Next.js framework, installs dependencies with pnpm, and uses `pnpm build`.

[Deploy this repository on Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdwright2k18%2FGTAVIWorldio)

No environment variables are required for preview deployments. Development and
preview builds default to `noindex` so sample content cannot enter search
results accidentally.

Before a public production launch, replace or approve the sample content and set:

```bash
NEXT_PUBLIC_SITE_URL=https://your-approved-domain.example
NEXT_PUBLIC_SITE_INDEXABLE=true
```

The indexing flag is honored only when an explicit canonical site URL is also
configured.
