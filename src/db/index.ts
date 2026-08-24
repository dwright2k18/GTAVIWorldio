import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

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
    // Build/prerender and ordinary application traffic keep the established
    // pooled connection. Discovery Cron uses a separately probed runtime path.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.gtaviworldSql = sqlClient;
}

const defaultDatabase = drizzle(sqlClient, { schema });
type AppDatabase = typeof defaultDatabase;

const databaseContext = new AsyncLocalStorage<AppDatabase>();

/**
 * Drizzle methods resolve against the request-scoped database selected by the
 * Cron runtime probe. All other server work continues to use the normal build
 * and application connection.
 */
export const db = new Proxy(defaultDatabase, {
  get(target, property) {
    const activeDatabase = databaseContext.getStore() ?? target;
    const value = Reflect.get(activeDatabase, property, activeDatabase) as unknown;
    return typeof value === "function" ? value.bind(activeDatabase) : value;
  },
}) as AppDatabase;

export function runWithDatabase<T>(database: AppDatabase, operation: () => T) {
  return databaseContext.run(database, operation);
}

export { sqlClient };
