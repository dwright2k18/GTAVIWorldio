import type { RuntimeDatabaseCandidate } from "./connection-url";
import {
  databaseOperationalCode,
  RuntimeDatabaseUnavailableError,
} from "./errors";

type RuntimeConnectionPolicyOptions<T> = {
  probe: (candidate: RuntimeDatabaseCandidate, attempt: number) => Promise<T>;
  isTransient: (error: unknown) => boolean;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type RuntimeConnectionSelection<T> = {
  candidate: RuntimeDatabaseCandidate;
  connection: T;
  attempts: number;
  failoverUsed: boolean;
  failureCodes: string[];
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * The transaction pooler gets one fresh retry. A distinct approved Supabase
 * endpoint gets one fallback attempt. Mutations are never replayed here: the
 * policy probes connectivity before the Cron begins database work.
 */
export async function selectRuntimeConnection<T>(
  candidates: RuntimeDatabaseCandidate[],
  options: RuntimeConnectionPolicyOptions<T>,
): Promise<RuntimeConnectionSelection<T>> {
  const sleep = options.sleep ?? wait;
  const failureCodes: string[] = [];
  let attempts = 0;

  for (const [candidateIndex, candidate] of candidates.entries()) {
    const candidateAttempts = candidateIndex === 0 ? 2 : 1;
    for (let candidateAttempt = 0; candidateAttempt < candidateAttempts; candidateAttempt += 1) {
      attempts += 1;
      try {
        const connection = await options.probe(candidate, candidateAttempt);
        return {
          candidate,
          connection,
          attempts,
          failoverUsed: candidateIndex > 0,
          failureCodes,
        };
      } catch (error) {
        if (!options.isTransient(error)) throw error;
        failureCodes.push(databaseOperationalCode(error));
        if (candidateIndex === 0 && candidateAttempt === 0) {
          await sleep(250);
        }
      }
    }
  }

  throw new RuntimeDatabaseUnavailableError(failureCodes);
}
