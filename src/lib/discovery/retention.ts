import "server-only";

import { asc, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { sourceSnapshots } from "@/db/schema";

export { discoverySnapshotExpiry } from "./retention-policy";

export async function purgeExpiredDiscoverySnapshots(now = new Date(), batchSize = 500) {
  const safeBatchSize = Math.max(1, Math.min(1_000, Math.floor(batchSize)));
  const expired = await db
    .select({ id: sourceSnapshots.id })
    .from(sourceSnapshots)
    .where(lte(sourceSnapshots.expiresAt, now))
    .orderBy(asc(sourceSnapshots.expiresAt))
    .limit(safeBatchSize);
  if (!expired.length) return 0;
  await db.delete(sourceSnapshots).where(inArray(sourceSnapshots.id, expired.map(({ id }) => id)));
  return expired.length;
}
