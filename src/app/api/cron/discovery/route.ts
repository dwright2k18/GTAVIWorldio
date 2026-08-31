import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db, runWithDatabase } from "@/db";
import {
  databaseOperationalCode,
  isDatabaseAvailabilityError,
} from "@/db/errors";
import { prepareRuntimeDatabase } from "@/db/runtime-connection";
import { discoverySettings, monitoredSources } from "@/db/schema";
import { cronRequestAuthorized } from "@/lib/discovery/cron-auth";
import {
  acquireDiscoveryCycleLock,
  releaseDiscoveryCycleLock,
} from "@/lib/discovery/execution-lock";
import { runDiscoverySource } from "@/lib/discovery/ingestion";
import { recurringDiscoveryEnabled } from "@/lib/discovery/pipeline";
import {
  connectorDueCutoff,
  connectorDuplicateCutoff,
} from "@/lib/discovery/cadence";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

type CronResult = {
  sourceId: string;
  source: string;
  status: string;
  created?: number;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!recurringDiscoveryEnabled() || !secret) {
    return Response.json({ error: "Recurring discovery is not activated." }, { status: 503 });
  }
  if (!cronRequestAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const runtime = await prepareRuntimeDatabase();
    if (runtime.failoverUsed) {
      console.warn("Discovery Cron database failover selected.", {
        attempts: runtime.attempts,
        connectionKind: runtime.connectionKind,
        failureCodes: runtime.failureCodes,
      });
    }
    return await runWithDatabase(runtime.database, executeDiscoveryCron);
  } catch (error) {
    console.error("Discovery Cron database preparation failed.", {
      code: databaseOperationalCode(error),
    });
    return Response.json(
      { error: "Discovery database is temporarily unavailable.", code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}

async function executeDiscoveryCron() {
  let phase = "control_read";
  let lockToken: string | null = null;

  try {
    const [settings] = await db
      .select({ enabled: discoverySettings.recurringMonitoringEnabled })
      .from(discoverySettings)
      .limit(1);

    phase = "lock_acquire";
    lockToken = await acquireDiscoveryCycleLock();
    if (!lockToken) {
      return Response.json(
        { monitoring: "candidate-only", publishing: false, status: "ALREADY_RUNNING" },
        { status: 202 },
      );
    }

    phase = "source_config_read";
    const sourceConfiguration = await db
      .select({ id: monitoredSources.id, active: monitoredSources.isActive })
      .from(monitoredSources);
    const activeSources = sourceConfiguration.filter((source) => source.active).length;

    let status = 200;
    let responseBody: Record<string, unknown>;

    if (!settings?.enabled) {
      status = 503;
      responseBody = {
        error: "Recurring discovery is disabled in newsroom controls.",
        databaseConnectivity: "READY",
        configuredSources: sourceConfiguration.length,
        activeSources,
        sourceFetches: 0,
        publishing: false,
      };
    } else {
      phase = "due_source_read";
      const now = new Date();
      const dueSources = await db
        .select({ id: monitoredSources.id, name: monitoredSources.name })
        .from(monitoredSources)
        .where(andActiveAndDue(now))
        .orderBy(asc(monitoredSources.authorityTier), asc(monitoredSources.nextCheckAt))
        .limit(5);
      const results: CronResult[] = [];

      for (const source of dueSources) {
        phase = `source_run:${source.id}`;
        try {
          const result = await runDiscoverySource(source.id, { mode: "RECURRING" });
          results.push({
            sourceId: source.id,
            source: source.name,
            status: result.status,
            created: "created" in result ? result.created : undefined,
          });
        } catch (error) {
          if (isDatabaseAvailabilityError(error)) throw error;
          results.push({ sourceId: source.id, source: source.name, status: "FAILED" });
        }
      }

      responseBody = {
        monitoring: "candidate-only",
        publishing: false,
        sourcesChecked: results.length,
        results,
      };
    }

    phase = "lock_release";
    const released = await releaseDiscoveryCycleLock(lockToken);
    lockToken = null;
    if (!released) {
      console.error("Discovery Cron lock release was not confirmed.", { phase });
      return Response.json(
        { error: "Discovery scheduler lock release was not confirmed." },
        { status: 503 },
      );
    }

    return Response.json(
      { ...responseBody, lockValidation: "ACQUIRED_AND_RELEASED" },
      { status },
    );
  } catch (error) {
    if (lockToken) {
      try {
        await releaseDiscoveryCycleLock(lockToken);
      } catch {
        console.error("Discovery Cron cleanup could not release its lock.", { phase });
      }
    }

    if (isDatabaseAvailabilityError(error)) {
      console.error("Discovery Cron database operation failed.", {
        phase,
        code: databaseOperationalCode(error),
      });
      return Response.json(
        { error: "Discovery database is temporarily unavailable.", code: "DATABASE_UNAVAILABLE" },
        { status: 503 },
      );
    }

    console.error("Discovery Cron stopped safely after an unexpected error.", { phase });
    return Response.json({ error: "Discovery Cron stopped safely." }, { status: 500 });
  }
}

function andActiveAndDue(now: Date) {
  return and(
    eq(monitoredSources.isActive, true),
    or(
      isNull(monitoredSources.nextCheckAt),
      lte(monitoredSources.nextCheckAt, connectorDueCutoff(now)),
    ),
    or(
      isNull(monitoredSources.lastCheckedAt),
      lte(monitoredSources.lastCheckedAt, connectorDuplicateCutoff(now)),
    ),
  );
}
