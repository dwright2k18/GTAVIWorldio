import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function databaseUrl() {
  // Prefer Supabase's session-pool endpoint. postgres-js can safely pipeline
  // newsroom reads there, while the transaction endpoint can stall under a
  // burst of related statements.
  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

  if (!url) {
    throw new Error("A PostgreSQL connection URL is not configured for this environment.");
  }

  return url;
}

const globalDatabase = globalThis as typeof globalThis & {
  gtaviworldSql?: ReturnType<typeof postgres>;
};

const sqlClient =
  globalDatabase.gtaviworldSql ??
  postgres(databaseUrl(), {
    // Supabase's transaction pool is most reliable here when each server
    // instance queues work through a single connection.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.gtaviworldSql = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
export { sqlClient };
