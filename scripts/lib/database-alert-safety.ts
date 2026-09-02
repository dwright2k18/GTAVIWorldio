export type ActiveOfficialSourceGapAlert = {
  id: string;
  alertType: string;
  sourceId: string | null;
  sourceUrl: string | null;
  detail: string;
  evidenceUrls: string[];
};

export const preservedHistoricalSourceGaps = [
  {
    id: "96a837d2-f77c-4f1d-ae41-2034ff1cf782",
    alertType: "OFFICIAL_SOURCE_GAP",
    sourceId: "41000000-0000-4000-8000-000000000002",
    sourceUrl: "https://www.rockstargames.com/VI",
    referencedUrlPrefix:
      "https://www.rockstargames.com/newswire/article/4k138k8okkk483",
  },
] as const;

export function validateActiveOfficialSourceGaps(
  alerts: ActiveOfficialSourceGapAlert[],
) {
  const issues: string[] = [];

  for (const alert of alerts) {
    const expected = preservedHistoricalSourceGaps.find(
      (entry) => entry.id === alert.id,
    );
    if (!expected) {
      issues.push(`Unknown active OFFICIAL_SOURCE_GAP alert ${alert.id}.`);
      continue;
    }
    if (
      alert.alertType !== expected.alertType ||
      alert.sourceId !== expected.sourceId ||
      alert.sourceUrl !== expected.sourceUrl
    ) {
      issues.push(`Historical alert ${alert.id} has an unexpected source relationship.`);
    }
    if (!alert.detail.includes(expected.referencedUrlPrefix)) {
      issues.push(`Historical alert ${alert.id} no longer references the expected source URL.`);
    }
    if (
      !alert.evidenceUrls.some((url) =>
        url.startsWith(expected.referencedUrlPrefix),
      )
    ) {
      issues.push(`Historical alert ${alert.id} is not resolved by preserved evidence.`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    allowedHistoricalAlertIds: alerts
      .filter((alert) =>
        preservedHistoricalSourceGaps.some((entry) => entry.id === alert.id),
      )
      .map((alert) => alert.id),
  };
}
