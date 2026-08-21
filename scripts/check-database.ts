import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.development.local", quiet: true });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("POSTGRES_URL_NON_POOLING is required to check the database.");
}

const client = postgres(connectionString, { max: 1, prepare: false });

async function main() {
  try {
    const [counts] = await client<
    Array<{
      stories: number;
      published: number;
      evergreen_pages: number;
      categories: number;
      policies: number;
      rls_tables: number;
    }>
    >`
    select
      (select count(*)::int from public.stories) as stories,
      (select count(*)::int from public.stories where status in ('PUBLISHED', 'UPDATED')) as published,
      (select count(*)::int from public.evergreen_pages) as evergreen_pages,
      (select count(*)::int from public.categories) as categories,
      (select count(*)::int from pg_policies where schemaname = 'public') as policies,
      (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity = true) as rls_tables
    `;

    console.log(JSON.stringify(counts, null, 2));

    if (
      counts.stories !== 8 ||
      counts.published !== 0 ||
      counts.evergreen_pages !== 11 ||
      counts.rls_tables < 19
    ) {
      throw new Error("Database safety checks did not match the expected Phase 3 state.");
    }
  } finally {
    await client.end();
  }
}

void main();
