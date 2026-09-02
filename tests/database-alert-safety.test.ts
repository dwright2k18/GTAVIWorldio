import { describe, expect, it } from "vitest";

import {
  preservedHistoricalSourceGaps,
  validateActiveOfficialSourceGaps,
  type ActiveOfficialSourceGapAlert,
} from "../scripts/lib/database-alert-safety";

const expected = preservedHistoricalSourceGaps[0];
const legitimateHistoricalAlert: ActiveOfficialSourceGapAlert = {
  id: expected.id,
  alertType: expected.alertType,
  sourceId: expected.sourceId,
  sourceUrl: expected.sourceUrl,
  detail: `An official signal references ${expected.referencedUrlPrefix}, but it could not be resolved at the time.`,
  evidenceUrls: [`${expected.referencedUrlPrefix}/grand-theft-auto-vi-an-extended-look-now-playing`],
};

describe("database alert safety", () => {
  it("allows only the identified historical gap when current evidence resolves it", () => {
    expect(validateActiveOfficialSourceGaps([legitimateHistoricalAlert])).toEqual({
      valid: true,
      issues: [],
      allowedHistoricalAlertIds: [expected.id],
    });
  });

  it("fails an unknown active gap", () => {
    const result = validateActiveOfficialSourceGaps([
      { ...legitimateHistoricalAlert, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatch(/unknown active/i);
  });

  it("fails a changed source relationship or unresolved historical gap", () => {
    const changed = validateActiveOfficialSourceGaps([
      { ...legitimateHistoricalAlert, sourceId: null, evidenceUrls: [] },
    ]);
    expect(changed.valid).toBe(false);
    expect(changed.issues).toEqual([
      expect.stringMatching(/unexpected source relationship/i),
      expect.stringMatching(/not resolved by preserved evidence/i),
    ]);
  });
});
