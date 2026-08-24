import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { configuredDatabaseUrl, databaseUrl } from "./connection-url";

export function isDatabaseConfigured() {
  return Boolean(configuredDatabaseUrl());
}

const globalDatabase = globalThis as typeof globalThis & {
  gtaviworldSql?: ReturnType<typeof postgres>;
};

const sqlClient =
  globalDatabase.gtaviworldSql ??
  postgres(databaseUrl(), {
    // Prefer Supabase's pooled POSTGRES_URL for Vercel build and runtime
    // connectivity, while retaining POSTGRES_URL_NON_POOLING as a fallback.
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
