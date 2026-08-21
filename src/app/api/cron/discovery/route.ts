import { timingSafeEqual } from "node:crypto";

import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { monitoredSources } from "@/db/schema";
import { runDiscoverySource } from "@/lib/discovery/ingestion";
import { recurringDiscoveryEnabled } from "@/lib/discovery/pipeline";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest, secret: string) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

export async function GET(request: NextRequest) {
  const secret = process.env.DISCOVERY_CRON_SECRET;
  if (!recurringDiscoveryEnabled() || !secret) {
    return Response.json({ error: "Recurring discovery is not activated." }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

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
}

function andActiveAndDue(now: Date) {
  return and(
    eq(monitoredSources.isActive, true),
    or(isNull(monitoredSources.nextCheckAt), lte(monitoredSources.nextCheckAt, now)),
  );
}
