export const DISCOVERY_CRON_INTERVAL_MINUTES = 120;
export const CONNECTOR_DUE_TOLERANCE_MS = 30_000;
export const CONNECTOR_DUPLICATE_DELIVERY_WINDOW_MS = 5 * 60_000;

const MINUTE_MS = 60_000;

type CadenceInput = {
  nextCheckAt: Date | null;
  lastCheckedAt: Date | null;
  now: Date;
};

export type ConnectorCadenceDecision =
  | { due: true; reason: "DUE" }
  | { due: false; reason: "TOO_EARLY" | "RECENT_ATTEMPT" };

export function connectorDueCutoff(now: Date) {
  return new Date(now.valueOf() + CONNECTOR_DUE_TOLERANCE_MS);
}

export function connectorDuplicateCutoff(now: Date) {
  return new Date(now.valueOf() - CONNECTOR_DUPLICATE_DELIVERY_WINDOW_MS);
}

export function connectorCadenceDecision({
  nextCheckAt,
  lastCheckedAt,
  now,
}: CadenceInput): ConnectorCadenceDecision {
  if (nextCheckAt && nextCheckAt > connectorDueCutoff(now)) {
    return { due: false, reason: "TOO_EARLY" };
  }
  if (lastCheckedAt && lastCheckedAt > connectorDuplicateCutoff(now)) {
    return { due: false, reason: "RECENT_ATTEMPT" };
  }
  return { due: true, reason: "DUE" };
}

function intervalMilliseconds(intervalMinutes: number) {
  if (!Number.isSafeInteger(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error("Connector interval must be a positive whole number of minutes.");
  }
  return intervalMinutes * MINUTE_MS;
}

function nearestUtcCronBoundary(at: Date) {
  const cronIntervalMs = DISCOVERY_CRON_INTERVAL_MINUTES * MINUTE_MS;
  return new Date(Math.round(at.valueOf() / cronIntervalMs) * cronIntervalMs);
}

export function nextScheduledConnectorCheck(options: {
  previousScheduledDueAt: Date | null;
  runStartedAt: Date;
  completedAt: Date;
  intervalMinutes: number;
}) {
  const intervalMs = intervalMilliseconds(options.intervalMinutes);
  const establishedDueAt = options.previousScheduledDueAt
    ?? nearestUtcCronBoundary(options.runStartedAt);
  let nextDueMs = establishedDueAt.valueOf() + intervalMs;

  if (nextDueMs <= options.completedAt.valueOf()) {
    const elapsedIntervals = Math.floor(
      (options.completedAt.valueOf() - nextDueMs) / intervalMs,
    ) + 1;
    nextDueMs += elapsedIntervals * intervalMs;
  }

  return new Date(nextDueMs);
}

export function scheduledDueAfterConnectorFailure(previousScheduledDueAt: Date | null) {
  return previousScheduledDueAt ? new Date(previousScheduledDueAt) : null;
}
