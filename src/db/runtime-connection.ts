import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import {
  runtimeDatabaseCandidates,
  type RuntimeDatabaseCandidate,
} from "./connection-url";
import { isDatabaseAvailabilityError } from "./errors";
import { selectRuntimeConnection } from "./runtime-connection-policy";

function createRuntimeConnection(candidate: RuntimeDatabaseCandidate) {
  const sqlClient = postgres(candidate.url, {
    max: 1,
    idle_timeout: 5,
    max_lifetime: 60,
    connect_timeout: 8,
    prepare: false,
    fetch_types: false,
  });
  return {
    database: drizzle(sqlClient, { schema }),
    sqlClient,
  };
}

type RuntimeConnection = ReturnType<typeof createRuntimeConnection>;

const globalRuntime = globalThis as typeof globalThis & {
  gtaviworldRuntimeConnections?: Map<string, RuntimeConnection>;
};

const connections =
  globalRuntime.gtaviworldRuntimeConnections ?? new Map<string, RuntimeConnection>();

if (process.env.NODE_ENV !== "production") {
  globalRuntime.gtaviworldRuntimeConnections = connections;
}

async function disposeConnection(candidate: RuntimeDatabaseCandidate, connection: RuntimeConnection) {
  if (connections.get(candidate.url) === connection) {
    connections.delete(candidate.url);
  }
  await connection.sqlClient.end({ timeout: 1 }).catch(() => undefined);
}

export async function prepareRuntimeDatabase() {
  const candidates = runtimeDatabaseCandidates();
  if (candidates.length === 0) {
    throw new Error("Runtime database configuration is unavailable.");
  }

  const selected = await selectRuntimeConnection(candidates, {
    isTransient: isDatabaseAvailabilityError,
    probe: async (candidate) => {
      const connection =
        connections.get(candidate.url) ?? createRuntimeConnection(candidate);
      connections.set(candidate.url, connection);
      try {
        await connection.sqlClient.unsafe("select 1");
        return connection;
      } catch (error) {
        await disposeConnection(candidate, connection);
        throw error;
      }
    },
  });

  return {
    database: selected.connection.database,
    connectionKind: selected.candidate.kind,
    attempts: selected.attempts,
    failoverUsed: selected.failoverUsed,
    failureCodes: selected.failureCodes,
  };
}
