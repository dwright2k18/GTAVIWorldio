const productionBuildPhase = "phase-production-build";

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
};

export type PublicBuildEnvironment = Record<string, string | undefined> & {
  NEXT_PHASE?: string;
};

export function isPublicStaticBuild(
  environment: PublicBuildEnvironment = process.env,
) {
  return environment.NEXT_PHASE === productionBuildPhase;
}

export function isDatabaseAvailabilityError(error: unknown) {
  const pending = [error];
  const visited = new Set<unknown>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (typeof current !== "object") continue;
    const details = current as ErrorDetails;
    const code = typeof details.code === "string" ? details.code.toUpperCase() : "";

    if (
      databaseAvailabilityCodes.has(code) ||
      postgresAvailabilityCodes.has(code) ||
      code.startsWith("08")
    ) {
      return true;
    }

    if (details.cause) pending.push(details.cause);
    if (Array.isArray(details.errors)) pending.push(...details.errors);
  }

  return false;
}

/**
 * Public static generation may safely use a deterministic empty/pre-launch
 * state when the CMS is temporarily unreachable. Runtime reads and every
 * mutation still receive the original error and therefore fail closed.
 */
export async function readPublicCmsWithBuildFallback<T>(
  read: () => Promise<T>,
  fallback: () => T,
  environment: PublicBuildEnvironment = process.env,
) {
  try {
    return await read();
  } catch (error) {
    if (
      !isPublicStaticBuild(environment) ||
      !isDatabaseAvailabilityError(error)
    ) {
      throw error;
    }

    return fallback();
  }
}
