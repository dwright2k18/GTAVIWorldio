import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.development.local", quiet: true });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  throw new Error("POSTGRES_URL_NON_POOLING is required to read the monitoring soak report.");
}

const requestedStart = process.argv[2];
const periodStart = requestedStart ? new Date(requestedStart) : new Date(Date.now() - 24 * 60 * 60 * 1_000);
if (Number.isNaN(periodStart.valueOf())) {
  throw new Error("The optional soak start must be an ISO-8601 timestamp.");
}

const officialSourceIds = [
  "41000000-0000-4000-8000-000000000001",
  "41000000-0000-4000-8000-000000000002",
  "41000000-0000-4000-8000-000000000003",
  "41000000-0000-4000-8000-000000000004",
  "41000000-0000-4000-8000-000000000009",
];

const client = postgres(connectionString, { max: 1, prepare: false });

async function main() {
  try {
    const sources = await client`
      select
        id,
        name,
        is_active,
        min_check_interval_minutes,
        health_status,
        consecutive_failures,
        circuit_open_until,
        last_checked_at,
        last_successful_fetch_at,
        next_check_at,
        last_error
      from public.monitored_sources
      where id = any(${officialSourceIds}::uuid[])
      order by id
    `;
    const [settings] = await client`
      select
        recurring_monitoring_enabled,
        automatic_drafting_enabled,
        deep_research_enabled,
        max_requests_per_day,
        max_candidates_per_day,
        max_candidates_per_run
      from public.discovery_settings
      limit 1
    `;
    const [runs] = await client`
      select
        count(*)::int as connector_runs,
        count(*) filter (where status = 'FAILED')::int as failures,
        coalesce(sum(request_count), 0)::int as requests,
        coalesce(sum(candidates_created), 0)::int as candidates_created,
        coalesce(sum(duplicates_skipped), 0)::int as duplicates_skipped,
        coalesce(sum(evidence_attached), 0)::int as evidence_attached,
        coalesce(sum(duration_ms), 0)::bigint as total_duration_ms,
        coalesce(max(duration_ms), 0)::int as slowest_duration_ms,
        coalesce(sum((metadata->'connectorMetrics'->>'conditionalRequests')::int), 0)::int as conditional_requests,
        coalesce(sum((metadata->'connectorMetrics'->>'notModifiedResponses')::int), 0)::int as not_modified_responses,
        coalesce(sum((metadata->'connectorMetrics'->>'hashUnchangedExits')::int), 0)::int as hash_unchanged_exits,
        coalesce(sum((metadata->'connectorMetrics'->>'detailFetchesAvoided')::int), 0)::int as detail_fetches_avoided,
        coalesce(sum((metadata->'connectorMetrics'->>'requestsSaved')::int), 0)::int as requests_saved
      from public.source_fetch_runs
      where source_id = any(${officialSourceIds}::uuid[])
        and started_at >= ${periodStart}
    `;
    const bySource = await client`
      select
        source_id,
        count(*)::int as connector_runs,
        count(*) filter (where status = 'FAILED')::int as failures,
        coalesce(sum(request_count), 0)::int as requests,
        coalesce(sum(candidates_created), 0)::int as candidates_created,
        coalesce(sum(duplicates_skipped), 0)::int as duplicates_skipped,
        coalesce(sum(evidence_attached), 0)::int as evidence_attached,
        coalesce(round(avg(request_count)::numeric, 2), 0) as average_requests_per_run,
        coalesce(round(avg(duration_ms)::numeric, 0), 0) as average_duration_ms,
        coalesce(sum((metadata->'connectorMetrics'->>'conditionalRequests')::int), 0)::int as conditional_requests,
        coalesce(sum((metadata->'connectorMetrics'->>'notModifiedResponses')::int), 0)::int as not_modified_responses,
        coalesce(sum((metadata->'connectorMetrics'->>'detailFetchesAvoided')::int), 0)::int as detail_fetches_avoided,
        coalesce(sum((metadata->'connectorMetrics'->>'requestsSaved')::int), 0)::int as requests_saved
      from public.source_fetch_runs
      where source_id = any(${officialSourceIds}::uuid[])
        and started_at >= ${periodStart}
      group by source_id
      order by source_id
    `;
    const [content] = await client`
      select
        (select count(*)::int from public.discovery_candidates where discovered_at < ${periodStart}) as candidates_before,
        (select count(*)::int from public.discovery_candidates) as candidates_after,
        (select count(*)::int from public.discovery_candidates where discovered_at >= ${periodStart} and is_test = false) as new_legitimate_candidates,
        (select count(*)::int from public.candidate_evidence where created_at >= ${periodStart}) as evidence_attached,
        (select count(*)::int from public.stories where updated_at >= ${periodStart}) as stories_modified,
        (select count(*)::int from public.stories where status in ('PUBLISHED', 'UPDATED')) as published,
        (select count(*)::int from public.stories where status = 'SCHEDULED') as scheduled,
        (select count(*)::int from public.discovery_execution_locks) as remaining_locks,
        (select count(*)::int from public.discovery_alerts where created_at >= ${periodStart} and alert_type = 'OFFICIAL_SOURCE_GAP') as coverage_gap_alerts,
        (select count(*)::int from public.discovery_alerts where created_at >= ${periodStart} and alert_type = 'SOURCE_CONNECTOR_FAILURE') as connector_failure_alerts,
        (select count(*)::int from public.discovery_audit_logs where created_at >= ${periodStart} and action = 'CONCURRENT_CANDIDATE_DUPLICATE_SUPPRESSED') as concurrent_duplicates_suppressed
    `;
    const usage = await client`
      select usage_date, request_count, candidates_created, ai_triage_calls, ai_research_calls, estimated_cost_micros
      from public.discovery_usage_daily
      where updated_at >= ${periodStart}
      order by usage_date
    `;

    console.log(JSON.stringify({
      period: { start: periodStart.toISOString(), end: new Date().toISOString() },
      settings,
      sources,
      runs,
      bySource,
      content,
      usage,
    }, null, 2));
  } finally {
    await client.end();
  }
}

void main();
