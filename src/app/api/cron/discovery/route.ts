import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { discoverySettings, monitoredSources } from "@/db/schema";
import { cronRequestAuthorized } from "@/lib/discovery/cron-auth";
import { acquireDiscoveryCycleLock, releaseDiscoveryCycleLock } from "@/lib/discovery/execution-lock";
import { runDiscoverySource } from "@/lib/discovery/ingestion";
import { recurringDiscoveryEnabled } from "@/lib/discovery/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!recurringDiscoveryEnabled() || !secret) {
    return Response.json({ error: "Recurring discovery is not activated." }, { status: 503 });
  }
  if (!cronRequestAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [settings] = await db.select({ enabled: discoverySettings.recurringMonitoringEnabled })
    .from(discoverySettings)
    .limit(1);
  if (!settings?.enabled) {
    return Response.json({ error: "Recurring discovery is disabled in newsroom controls." }, { status: 503 });
  }

  const lockToken = await acquireDiscoveryCycleLock();
  if (!lockToken) {
    return Response.json({ monitoring: "candidate-only", publishing: false, status: "ALREADY_RUNNING" }, { status: 202 });
  }

  try {
    const now = new Date();
    const dueSources = await db
      .select({ id: monitoredSources.id, name: monitoredSources.name })
      .from(monitoredSources)
      .where(andActiveAndDue(now))
      .orderBy(asc(monitoredSources.authorityTier), asc(monitoredSources.nextCheckAt))
      .limit(5);
    const results: Array<{ sourceId: string; source: string; status: string; created?: number }> = [];
    for (const source of dueSources) {
      try {
        const result = await runDiscoverySource(source.id, { mode: "RECURRING" });
        results.push({ sourceId: source.id, source: source.name, status: result.status, created: "created" in result ? result.created : undefined });
      } catch {
        results.push({ sourceId: source.id, source: source.name, status: "FAILED" });
      }
    }
    return Response.json({ monitoring: "candidate-only", publishing: false, sourcesChecked: results.length, results });
  } finally {
    await releaseDiscoveryCycleLock(lockToken);
  }
}

function andActiveAndDue(now: Date) {
  return and(
    eq(monitoredSources.isActive, true),
    or(isNull(monitoredSources.nextCheckAt), lte(monitoredSources.nextCheckAt, now)),
  );
}
