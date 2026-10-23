import { describe, expect, it } from "vitest";

import {
  evaluateAutomaticPublicationPolicy,
  type AutomaticPublicationInput,
} from "@/lib/grok-worker/policy";

const passingInput: AutomaticPublicationInput = {
  sourceIsFirstParty: true,
  sourceActive: true,
  sourceAuthorityTier: "TIER_1",
  candidateStatus: "DISCOVERED",
  candidateIsTest: false,
  verificationStatus: "CONFIRMED",
  confidenceScore: 95,
  unresolvedSourceGapCount: 0,
  hasConflictingEvidence: false,
  duplicateStatus: "NEW_STORY",
  everyClaimHasEvidence: true,
  everyQuoteHasProvenance: true,
  groundingPassed: true,
  factCheckPassed: true,
  mediaRightsPassed: true,
  seoPassed: true,
  dailyPublicationCap: 1,
  dailyPublicationCount: 0,
  emergencyStop: false,
  apiEnabled: true,
  databaseAutoPublishEnabled: true,
  environmentAutoPublishEnabled: true,
  evidenceSnapshotMatches: true,
  independentFactCheckRun: true,
  defaultAuthorConfigured: true,
};

describe("Grok automatic-publication policy", () => {
  it("allows only the complete strict first-party case", () => {
    const result = evaluateAutomaticPublicationPolicy(passingInput);
    expect(result.eligible).toBe(true);
    expect(result.failed).toEqual([]);
  });

  it.each([
    ["secondary source", { sourceIsFirstParty: false }],
    ["inactive source", { sourceActive: false }],
    ["lower source tier", { sourceAuthorityTier: "TIER_2" }],
    ["rejected workflow", { candidateStatus: "REJECTED" }],
    ["test candidate", { candidateIsTest: true }],
    ["credible report", { verificationStatus: "CREDIBLE_REPORT" }],
    ["confidence 94", { confidenceScore: 94 }],
    ["source gap", { unresolvedSourceGapCount: 1 }],
    ["conflict", { hasConflictingEvidence: true }],
    ["related candidate", { duplicateStatus: "RELATED" }],
    ["missing claim evidence", { everyClaimHasEvidence: false }],
    ["missing quote provenance", { everyQuoteHasProvenance: false }],
    ["grounding failure", { groundingPassed: false }],
    ["fact-check failure", { factCheckPassed: false }],
    ["non-independent fact check", { independentFactCheckRun: false }],
    ["rights uncertainty", { mediaRightsPassed: false }],
    ["SEO failure", { seoPassed: false }],
    ["stale evidence", { evidenceSnapshotMatches: false }],
    ["emergency stop", { emergencyStop: true }],
    ["API gate off", { apiEnabled: false }],
    ["environment publication gate off", { environmentAutoPublishEnabled: false }],
    ["database publication gate off", { databaseAutoPublishEnabled: false }],
    ["zero cap", { dailyPublicationCap: 0 }],
    ["full cap", { dailyPublicationCount: 1 }],
    ["no author", { defaultAuthorConfigured: false }],
  ] satisfies Array<[string, Partial<AutomaticPublicationInput>]>) (
    "blocks %s",
    (_name, patch) => {
      expect(
        evaluateAutomaticPublicationPolicy({ ...passingInput, ...patch }).eligible,
      ).toBe(false);
    },
  );
});
