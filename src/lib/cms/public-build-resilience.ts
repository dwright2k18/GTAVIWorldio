import { isDatabaseAvailabilityError } from "@/db/errors";

export { isDatabaseAvailabilityError } from "@/db/errors";

const productionBuildPhase = "phase-production-build";

export type PublicBuildEnvironment = Record<string, string | undefined> & {
  NEXT_PHASE?: string;
};

export function isPublicStaticBuild(
  environment: PublicBuildEnvironment = process.env,
) {
  return environment.NEXT_PHASE === productionBuildPhase;
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
