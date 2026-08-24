import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.development.local", quiet: true });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is required for scheduler database tests.");

const client = postgres(connectionString, { max: 12, prepare: false });
const usageDate = "2099-04-03";
const lockName = `scheduler-qa-${randomUUID()}`;

async function expectDirectApiDenied(role: "anon" | "authenticated", statement: string) {
  let denied = false;
  try {
    await client.begin(async (sql) => {
      await sql.unsafe(`set local role ${role}`);
      await sql.unsafe(statement);
    });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error(`${role} unexpectedly accessed a protected scheduler database primitive.`);
}

async function main() {
  try {
    const [settings] = await client<Array<{
      recurring: boolean;
      requests: number;
      candidates: number;
      active_sources: number;
    }>>`
      select
        recurring_monitoring_enabled as recurring,
        max_requests_per_day as requests,
        max_candidates_per_day as candidates,
        (select count(*)::int from public.monitored_sources where is_active) as active_sources
      from public.discovery_settings
      limit 1
    `;
    if (settings.recurring || settings.requests !== 80 || settings.candidates !== 5 || settings.active_sources !== 0) {
      throw new Error("Scheduler safety settings are not in the approved inactive state.");
    }

    const sourceIntervals = await client<Array<{ id: string; interval: number; details: number }>>`
      select id, min_check_interval_minutes as interval,
        coalesce((connector_config->>'maxDetailItems')::int, 0) as details
      from public.monitored_sources
      where id in (
        '41000000-0000-4000-8000-000000000001',
        '41000000-0000-4000-8000-000000000002',
        '41000000-0000-4000-8000-000000000003',
        '41000000-0000-4000-8000-000000000004',
        '41000000-0000-4000-8000-000000000009'
      )
      order by id
    `;
    const expected = new Map([
      ["41000000-0000-4000-8000-000000000001", 360],
      ["41000000-0000-4000-8000-000000000002", 240],
      ["41000000-0000-4000-8000-000000000003", 360],
      ["41000000-0000-4000-8000-000000000004", 360],
      ["41000000-0000-4000-8000-000000000009", 120],
    ]);
    if (sourceIntervals.length !== 5 || sourceIntervals.some((source) => source.interval !== expected.get(source.id) || source.details > 3)) {
      throw new Error("Official source intervals or detail limits do not match the approved pilot configuration.");
    }

    const requestReservations = await Promise.all(Array.from({ length: 100 }, () => client<Array<{ reserved: boolean }>>`
      select public.reserve_discovery_daily_usage(${usageDate}, 1, 0, 80, 5) as reserved
    `));
    if (requestReservations.filter(([row]) => row.reserved).length !== 80) {
      throw new Error("Concurrent request reservations did not stop exactly at 80.");
    }

    const candidateReservations = await Promise.all(Array.from({ length: 10 }, () => client<Array<{ reserved: boolean }>>`
      select public.reserve_discovery_daily_usage(${usageDate}, 0, 1, 80, 5) as reserved
    `));
    if (candidateReservations.filter(([row]) => row.reserved).length !== 5) {
      throw new Error("Concurrent candidate reservations did not stop exactly at 5.");
    }

    const lockTokens = Array.from({ length: 10 }, () => randomUUID());
    const lockAttempts = await Promise.all(lockTokens.map((token) => client<Array<{ acquired: boolean }>>`
      select public.acquire_discovery_execution_lock(${lockName}, ${token}::uuid, 60) as acquired
    `));
    const winners = lockAttempts.filter(([row]) => row.acquired);
    if (winners.length !== 1) throw new Error("Overlapping scheduler requests acquired more than one execution lock.");

    await client`update public.discovery_execution_locks set expires_at = now() - interval '1 second' where lock_name = ${lockName}`;
    const replacementToken = randomUUID();
    const [replacement] = await client<Array<{ acquired: boolean }>>`
      select public.acquire_discovery_execution_lock(${lockName}, ${replacementToken}::uuid, 60) as acquired
    `;
    if (!replacement.acquired) throw new Error("An expired scheduler lock could not be safely replaced.");
    const [released] = await client<Array<{ released: boolean }>>`
      select public.release_discovery_execution_lock(${lockName}, ${replacementToken}::uuid) as released
    `;
    if (!released.released) throw new Error("The current scheduler lock owner could not release its lock.");

    await expectDirectApiDenied("anon", "select * from public.discovery_execution_locks");
    await expectDirectApiDenied("authenticated", "select public.acquire_discovery_execution_lock('forbidden', gen_random_uuid(), 60)");

    console.log(JSON.stringify({
      requestReservationsAccepted: 80,
      requestReservationsSuppressed: 20,
      candidateReservationsAccepted: 5,
      candidateReservationsSuppressed: 5,
      concurrentLockWinners: 1,
      expiredLockReacquired: true,
      anonDenied: true,
      authenticatedDenied: true,
      activeSources: 0,
      recurringMonitoring: false,
    }, null, 2));
  } finally {
    await client`delete from public.discovery_usage_daily where usage_date = ${usageDate}`;
    await client`delete from public.discovery_execution_locks where lock_name = ${lockName}`;
    await client.end();
  }
}

void main();
