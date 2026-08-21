export function discoverySnapshotExpiry(discoveredAt: Date, retentionDays: number) {
  const safeDays = Math.max(1, Math.min(365, Math.floor(retentionDays)));
  return new Date(discoveredAt.valueOf() + safeDays * 86_400_000);
}
