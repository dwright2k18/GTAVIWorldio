export const CONNECTOR_FAILURE_THRESHOLD = 3;
export const CONNECTOR_FAILURE_PAUSE_MS = 6 * 60 * 60 * 1_000;

export function connectorFailureState(currentFailures: number, completedAt: Date) {
  const consecutiveFailures = currentFailures + 1;
  const circuitOpen = consecutiveFailures >= CONNECTOR_FAILURE_THRESHOLD;
  return {
    consecutiveFailures,
    healthStatus: circuitOpen ? "CIRCUIT_OPEN" as const : "FAILED" as const,
    circuitOpenUntil: circuitOpen
      ? new Date(completedAt.valueOf() + CONNECTOR_FAILURE_PAUSE_MS)
      : null,
  };
}
