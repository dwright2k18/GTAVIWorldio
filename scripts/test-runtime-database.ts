import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.development.local", quiet: true });

async function main() {
  const [databaseModule, runtimeModule, lockModule, schemaModule] = await Promise.all([
    import("../src/db"),
    import("../src/db/runtime-connection"),
    import("../src/lib/discovery/execution-lock"),
    import("../src/db/schema"),
  ]);
  const runtime = await runtimeModule.prepareRuntimeDatabase();

  const result = await databaseModule.runWithDatabase(runtime.database, async () => {
    const [settings] = await databaseModule.db
      .select({ enabled: schemaModule.discoverySettings.recurringMonitoringEnabled })
      .from(schemaModule.discoverySettings)
      .limit(1);
    const before = await databaseModule.db.execute<{
      candidates: number;
      stories: number;
    }>(sql`
      select
        (select count(*)::int from public.discovery_candidates) as candidates,
        (select count(*)::int from public.stories) as stories
    `);

    let lockToken: string | null = null;
    let released = false;
    let sources: Array<{ id: string; active: boolean }> = [];
    try {
      lockToken = await lockModule.acquireDiscoveryCycleLock();
      if (!lockToken) throw new Error("The runtime QA lock could not be acquired.");
      sources = await databaseModule.db
        .select({ id: schemaModule.monitoredSources.id, active: schemaModule.monitoredSources.isActive })
        .from(schemaModule.monitoredSources);
    } finally {
      if (lockToken) released = await lockModule.releaseDiscoveryCycleLock(lockToken);
    }
    if (!released) throw new Error("The runtime QA lock was not released.");

    const after = await databaseModule.db.execute<{
      candidates: number;
      stories: number;
      locks: number;
    }>(sql`
      select
        (select count(*)::int from public.discovery_candidates) as candidates,
        (select count(*)::int from public.stories) as stories,
        (select count(*)::int from public.discovery_execution_locks) as locks
    `);

    if (settings?.enabled || sources.some((source) => source.active)) {
      throw new Error("Runtime database QA requires recurring monitoring and every source to remain off.");
    }
    if (
      before[0]?.candidates !== after[0]?.candidates ||
      before[0]?.stories !== after[0]?.stories ||
      after[0]?.locks !== 0
    ) {
      throw new Error("Runtime database QA changed protected content state or left a lock behind.");
    }

    return {
      recurringMonitoring: false,
      configuredSources: sources.length,
      activeSources: 0,
      lockAcquiredAndReleased: true,
      externalSourceFetches: 0,
      candidateChanges: 0,
      storyChanges: 0,
      staleLocks: 0,
    };
  });

  console.log(JSON.stringify({
    connectionKind: runtime.connectionKind,
    attempts: runtime.attempts,
    failoverUsed: runtime.failoverUsed,
    failureCodes: runtime.failureCodes,
    ...result,
  }, null, 2));
}

void main();
