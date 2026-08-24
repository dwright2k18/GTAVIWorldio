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

## Discovery scheduler safety

The official-source scheduler is configured to call `/api/cron/discovery` every
two hours. Vercel must provide the server-only `CRON_SECRET`, and Production must
set `DISCOVERY_RECURRING_ENABLED=true`. Those environment controls are necessary
but not sufficient: the newsroom database switch and each individual source must
also be active before a connector can run.

The Phase 4.3 hardening migration intentionally leaves the database switch and
all nine sources off. It also applies an atomic limit of 80 source requests and
five new candidates per UTC day, caps detail-page fetches at three per connector
execution, and prevents overlapping discovery cycles with an expiring database
lock. No drafting, publishing, paid AI, analytics, or public indexing is enabled
by the scheduler configuration.

Build/prerender keeps the established pooled connection and deterministic public
fallback. The discovery Cron separately probes Supabase's transaction pooler,
retries one fresh connection after a recognized transient startup failure, and
then permits one attempt through the existing server-only session/direct URL.
The selected database is scoped to that Cron execution, uses one connection,
disables prepared statements, and closes idle connections quickly. This bounded
selection happens before any connector or mutation runs; SQL, authorization, and
programming errors are not retried.

While the newsroom recurring switch is off, an authenticated Cron invocation
performs only a control read, rollback-safe lock acquire/release, and source
configuration read. It performs no external source request and creates or
modifies no candidate or story.

Scheduled publishing is a separate default-off capability. Its endpoint requires
both valid cron authentication and `SCHEDULED_PUBLISHING_ENABLED=true`; the
discovery gate cannot enable publishing, and the publishing gate cannot enable
discovery. Keep the publishing variable unset until a separately approved launch.

## Pre-launch feature gates

The following public environment variables default to off. Enable them only
after their live editorial inputs are ready:

- `NEXT_PUBLIC_BREAKING_ENABLED=true` — requires an active, time-sensitive item.
- `NEXT_PUBLIC_AUDIENCE_RANKINGS_ENABLED=true` — requires real audience metrics.
- `NEXT_PUBLIC_QUICK_HITS_ENABLED=true` — also requires approved video assets on
  the Quick Hit records; artwork-only records stay hidden.
- `NEXT_PUBLIC_CONTACT_EMAIL=newsroom@example.com` — publishes the monitored
  address on Contact and Corrections. Without it, both pages remain pre-launch.

Before a public production launch, complete editorial and legal approval, connect
a monitored contact route, confirm the canonical domain, and set:

```bash
NEXT_PUBLIC_SITE_URL=https://gtaviworld.io
NEXT_PUBLIC_SITE_INDEXABLE=true
```

The indexing flag is honored only when an explicit canonical site URL is also
configured.
