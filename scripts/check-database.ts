import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
      scheduled: number;
      evergreen_pages: number;
      categories: number;
      policies: number;
      rls_tables: number;
      anonymous_table_grants: number;
      profile_mutation_grants: number;
      policy_test_users: number;
      monitored_sources: number;
      active_monitored_sources: number;
      discovery_candidates: number;
      test_candidates: number;
      discovery_settings: number;
      recurring_monitoring_enabled: boolean;
      automatic_drafting_enabled: boolean;
      deep_research_enabled: boolean;
    }>
    >`
    select
      (select count(*)::int from public.stories) as stories,
      (select count(*)::int from public.stories where status in ('PUBLISHED', 'UPDATED')) as published,
      (select count(*)::int from public.stories where status = 'SCHEDULED') as scheduled,
      (select count(*)::int from public.evergreen_pages) as evergreen_pages,
      (select count(*)::int from public.categories) as categories,
      (select count(*)::int from pg_policies where schemaname = 'public') as policies,
      (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity = true) as rls_tables,
      (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon') as anonymous_table_grants,
      (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'editor_profiles' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')) as profile_mutation_grants,
      (select count(*)::int from auth.users where email like 'rls-%@example.invalid') as policy_test_users,
      (select count(*)::int from public.monitored_sources) as monitored_sources,
      (select count(*)::int from public.monitored_sources where is_active = true) as active_monitored_sources,
      (select count(*)::int from public.discovery_candidates) as discovery_candidates,
      (select count(*)::int from public.discovery_candidates where is_test = true) as test_candidates,
      (select count(*)::int from public.discovery_settings) as discovery_settings,
      (select coalesce(bool_or(recurring_monitoring_enabled), false) from public.discovery_settings) as recurring_monitoring_enabled,
      (select coalesce(bool_or(automatic_drafting_enabled), false) from public.discovery_settings) as automatic_drafting_enabled,
      (select coalesce(bool_or(deep_research_enabled), false) from public.discovery_settings) as deep_research_enabled
    `;

    const migrationSql = await readFile("drizzle/0004_phase_4_discovery.sql");
    const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
    const [migrationState] = await client<Array<{ total: number; latest_hash: string }>>`
      select count(*)::int as total, (array_agg(hash order by created_at desc))[1] as latest_hash
      from drizzle.__drizzle_migrations
    `;

    console.log(JSON.stringify({
      ...counts,
      migrations: migrationState.total,
      latest_migration_matches: migrationState.latest_hash === migrationHash,
    }, null, 2));

    if (
      counts.stories !== 8 ||
      counts.published !== 0 ||
      counts.scheduled !== 0 ||
      counts.evergreen_pages !== 11 ||
      counts.rls_tables !== 29 ||
      counts.anonymous_table_grants !== 0 ||
      counts.profile_mutation_grants !== 0 ||
      counts.policy_test_users !== 0 ||
      counts.monitored_sources !== 8 ||
      counts.active_monitored_sources !== 0 ||
      counts.discovery_candidates !== 0 ||
      counts.test_candidates !== 0 ||
      counts.discovery_settings !== 1 ||
      counts.recurring_monitoring_enabled ||
      counts.automatic_drafting_enabled ||
      counts.deep_research_enabled ||
      migrationState.total !== 5 ||
      migrationState.latest_hash !== migrationHash
    ) {
      throw new Error("Database safety checks did not match the expected Phase 4 test-mode state.");
    }
  } finally {
    await client.end();
  }
}

void main();
