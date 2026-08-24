const databaseAvailabilityCodes = new Set([
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "RUNTIME_DATABASE_UNAVAILABLE",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const postgresAvailabilityCodes = new Set([
  "53300", // too_many_connections
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
]);

type ErrorDetails = {
  cause?: unknown;
  code?: unknown;
  errors?: unknown;
  message?: unknown;
};

function errorChain(error: unknown) {
  const pending = [error];
  const visited = new Set<unknown>();
  const chain: ErrorDetails[] = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (typeof current !== "object") continue;

    const details = current as ErrorDetails;
    chain.push(details);
    if (details.cause) pending.push(details.cause);
    if (Array.isArray(details.errors)) pending.push(...details.errors);
  }

  return chain;
}

export function isDatabaseAvailabilityError(error: unknown) {
  return errorChain(error).some((details) => {
    const code = typeof details.code === "string" ? details.code.toUpperCase() : "";
    const message = typeof details.message === "string" ? details.message : "";

    return (
      databaseAvailabilityCodes.has(code) ||
      postgresAvailabilityCodes.has(code) ||
      code.startsWith("08") ||
      /\bEAUTHQUERY\b/i.test(message) ||
      /auth_query[^.]*timed out/i.test(message)
    );
  });
}

/** Returns only a non-sensitive operational code suitable for server logs. */
export function databaseOperationalCode(error: unknown) {
  for (const details of errorChain(error)) {
    const message = typeof details.message === "string" ? details.message : "";
    if (/\bEAUTHQUERY\b/i.test(message) || /auth_query[^.]*timed out/i.test(message)) {
      return "EAUTHQUERY";
    }
    if (typeof details.code === "string" && details.code.trim()) {
      return details.code.toUpperCase();
    }
  }
  return "DATABASE_UNAVAILABLE";
}

export class RuntimeDatabaseUnavailableError extends Error {
  readonly code = "RUNTIME_DATABASE_UNAVAILABLE";
  readonly failureCodes: string[];

  constructor(failureCodes: string[]) {
    super("No approved runtime database connection is currently available.");
    this.name = "RuntimeDatabaseUnavailableError";
    this.failureCodes = failureCodes;
  }
}
