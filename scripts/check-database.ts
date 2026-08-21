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
      legitimate_candidate_present: boolean;
      test_candidates: number;
      discovery_settings: number;
      recurring_monitoring_enabled: boolean;
      automatic_drafting_enabled: boolean;
      deep_research_enabled: boolean;
      candidate_evidence_count: number;
      source_health: Array<{
        id: string;
        name: string;
        active: boolean;
        health: string;
        method: string | null;
        last_successful_fetch_at: string | null;
        last_successful_extraction_at: string | null;
        last_discovered_item_at: string | null;
        last_http_status: number | null;
        consecutive_failures: number;
        last_content_hash: string | null;
        last_error: string | null;
      }>;
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
      (select exists(select 1 from public.discovery_candidates where id = '70db3fc3-0671-4824-80b4-6682ac6d7b76' and is_test = false and story_id is null)) as legitimate_candidate_present,
      (select count(*)::int from public.discovery_candidates where is_test = true) as test_candidates,
      (select count(*)::int from public.discovery_settings) as discovery_settings,
      (select coalesce(bool_or(recurring_monitoring_enabled), false) from public.discovery_settings) as recurring_monitoring_enabled,
      (select coalesce(bool_or(automatic_drafting_enabled), false) from public.discovery_settings) as automatic_drafting_enabled,
      (select coalesce(bool_or(deep_research_enabled), false) from public.discovery_settings) as deep_research_enabled
      ,(select count(*)::int from public.candidate_evidence where candidate_id = '70db3fc3-0671-4824-80b4-6682ac6d7b76') as candidate_evidence_count
      ,(select coalesce(json_agg(json_build_object(
        'id', id,
        'name', name,
        'active', is_active,
        'health', health_status,
        'method', last_extraction_method,
        'last_successful_fetch_at', last_successful_fetch_at,
        'last_successful_extraction_at', last_successful_extraction_at,
        'last_discovered_item_at', last_discovered_item_at,
        'last_http_status', last_http_status,
        'consecutive_failures', consecutive_failures,
        'last_content_hash', last_content_hash,
        'last_error', last_error
      ) order by id), '[]'::json) from public.monitored_sources where id in (
        '41000000-0000-4000-8000-000000000001',
        '41000000-0000-4000-8000-000000000004',
        '41000000-0000-4000-8000-000000000009'
      )) as source_health
    `;

    const migrationSql = await readFile("drizzle/0005_phase_4_1_source_hardening.sql");
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
      counts.monitored_sources !== 9 ||
      counts.active_monitored_sources !== 0 ||
      counts.discovery_candidates !== 1 ||
      !counts.legitimate_candidate_present ||
      counts.test_candidates !== 0 ||
      counts.discovery_settings !== 1 ||
      counts.recurring_monitoring_enabled ||
      counts.automatic_drafting_enabled ||
      counts.deep_research_enabled ||
      migrationState.total !== 6 ||
      migrationState.latest_hash !== migrationHash
    ) {
      throw new Error("Database safety checks did not match the expected Phase 4.1 test-mode state.");
    }
  } finally {
    await client.end();
  }
}

void main();
