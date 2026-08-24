import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

import {
  migrationHashesMatch,
  normalizedMigrationHash,
} from "./lib/migration-integrity";

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
      max_requests_per_day: number;
      max_candidates_per_day: number;
      scheduler_locks: number;
      candidate_evidence_count: number;
      discovery_score_runs: number;
      discovery_score_overrides: number;
      official_source_gap_alerts: number;
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
        coverage_group: string | null;
        signal_label: string | null;
        min_check_interval_minutes: number;
        max_detail_items: number;
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
      ,(select max(max_requests_per_day)::int from public.discovery_settings) as max_requests_per_day
      ,(select max(max_candidates_per_day)::int from public.discovery_settings) as max_candidates_per_day
      ,(select count(*)::int from public.discovery_execution_locks) as scheduler_locks
      ,(select count(*)::int from public.candidate_evidence where candidate_id = '70db3fc3-0671-4824-80b4-6682ac6d7b76') as candidate_evidence_count
      ,(select count(*)::int from public.discovery_score_runs) as discovery_score_runs
      ,(select count(*)::int from public.discovery_score_overrides) as discovery_score_overrides
      ,(select count(*)::int from public.discovery_alerts where alert_type = 'OFFICIAL_SOURCE_GAP' and status in ('NEW', 'ACKNOWLEDGED')) as official_source_gap_alerts
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
        ,'coverage_group', coverage_group
        ,'signal_label', signal_label
        ,'min_check_interval_minutes', min_check_interval_minutes
        ,'max_detail_items', coalesce((connector_config->>'maxDetailItems')::int, 0)
      ) order by id), '[]'::json) from public.monitored_sources where id in (
        '41000000-0000-4000-8000-000000000001',
        '41000000-0000-4000-8000-000000000002',
        '41000000-0000-4000-8000-000000000003',
        '41000000-0000-4000-8000-000000000004',
        '41000000-0000-4000-8000-000000000009'
      )) as source_health
    `;

    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: Array<{ tag: string }> };
    const expectedMigrations = await Promise.all(
      journal.entries.map(async ({ tag }) => ({
        tag,
        hash: normalizedMigrationHash(await readFile(`drizzle/${tag}.sql`, "utf8")),
      })),
    );
    const migrationLedger = await client<Array<{ id: number; hash: string }>>`
      select id, hash from drizzle.__drizzle_migrations order by id
    `;
    const hashesMatch = migrationHashesMatch(expectedMigrations, migrationLedger);
    const latestMigration = expectedMigrations.at(-1)?.tag ?? null;

    console.log(JSON.stringify({
      ...counts,
      migrations: migrationLedger.length,
      latest_migration: latestMigration,
      migration_hashes_match: hashesMatch,
    }, null, 2));

    if (
      counts.stories !== 8 ||
      counts.published !== 0 ||
      counts.scheduled !== 0 ||
      counts.evergreen_pages !== 11 ||
      counts.rls_tables !== 32 ||
      counts.anonymous_table_grants !== 0 ||
      counts.profile_mutation_grants !== 0 ||
      counts.policy_test_users !== 0 ||
      counts.monitored_sources !== 9 ||
      counts.active_monitored_sources !== 0 ||
      counts.discovery_candidates !== 1 ||
      !counts.legitimate_candidate_present ||
      counts.test_candidates !== 0 ||
      counts.discovery_score_runs !== 1 ||
      counts.discovery_score_overrides !== 0 ||
      counts.official_source_gap_alerts !== 0 ||
      counts.discovery_settings !== 1 ||
      counts.recurring_monitoring_enabled ||
      counts.automatic_drafting_enabled ||
      counts.deep_research_enabled ||
      counts.max_requests_per_day !== 80 ||
      counts.max_candidates_per_day !== 5 ||
      counts.scheduler_locks !== 0 ||
      counts.source_health.some((source) => source.active || source.max_detail_items > 3) ||
      counts.source_health.find((source) => source.id === "41000000-0000-4000-8000-000000000001")?.min_check_interval_minutes !== 360 ||
      counts.source_health.find((source) => source.id === "41000000-0000-4000-8000-000000000002")?.min_check_interval_minutes !== 240 ||
      counts.source_health.find((source) => source.id === "41000000-0000-4000-8000-000000000003")?.min_check_interval_minutes !== 360 ||
      counts.source_health.find((source) => source.id === "41000000-0000-4000-8000-000000000004")?.min_check_interval_minutes !== 360 ||
      counts.source_health.find((source) => source.id === "41000000-0000-4000-8000-000000000009")?.min_check_interval_minutes !== 120 ||
      expectedMigrations.length !== 8 ||
      migrationLedger.length !== expectedMigrations.length ||
      !hashesMatch
    ) {
      throw new Error("Database safety checks did not match the expected Phase 4.2 disabled state.");
    }
  } finally {
    await client.end();
  }
}

void main();
