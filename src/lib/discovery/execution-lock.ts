import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

export const DISCOVERY_CYCLE_LOCK_NAME = "official-source-discovery-cycle";
export const DISCOVERY_CYCLE_LOCK_TTL_SECONDS = 900;

export async function acquireDiscoveryCycleLock() {
  const token = randomUUID();
  const rows = await db.execute<{ acquired: boolean }>(sql`
    select public.acquire_discovery_execution_lock(
      ${DISCOVERY_CYCLE_LOCK_NAME},
      ${token}::uuid,
      ${DISCOVERY_CYCLE_LOCK_TTL_SECONDS}
    ) as acquired
  `);
  return rows[0]?.acquired ? token : null;
}

export async function releaseDiscoveryCycleLock(token: string) {
  const rows = await db.execute<{ released: boolean }>(sql`
    select public.release_discovery_execution_lock(
      ${DISCOVERY_CYCLE_LOCK_NAME},
      ${token}::uuid
    ) as released
  `);
  return Boolean(rows[0]?.released);
}
