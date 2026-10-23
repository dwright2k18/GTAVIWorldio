import "server-only";

import { grokAutoPublishEnvironmentEnabled } from "./config";
import {
  evaluateAutomaticPublicationPolicy,
  type PublicationGate,
} from "./policy";
import { GrokWorkerRepository } from "./repository";
import type { GrokWorkerPrincipal } from "./auth";

function gateSnapshot(gates: Record<string, PublicationGate>) {
  return Object.fromEntries(
    Object.entries(gates).map(([name, gate]) => [name, gate.passed]),
  );
}

export async function attemptAutomaticPublication(
  repository: GrokWorkerRepository,
  candidateId: string,
  audit?: {
    principal: GrokWorkerPrincipal;
    workItemId: string;
    requestId: string;
  },
) {
  const context = await repository.loadPublicationContext(candidateId);
  if (!context.ready) {
    return {
      decision: "BLOCKED" as const,
      published: false,
      failed: [{ gate: "artifactBundle", reason: context.reason }],
    };
  }

  const evaluation = evaluateAutomaticPublicationPolicy({
    ...context.policyInput,
    environmentAutoPublishEnabled: grokAutoPublishEnvironmentEnabled(),
  });
  const snapshot = gateSnapshot(evaluation.gates);

  if (!evaluation.eligible) {
    await repository.recordBlockedPublicationEvaluation({
      candidateId,
      draftSubmissionId: context.draft.id,
      policyVersion: evaluation.policyVersion,
      gateSnapshot: snapshot,
      evidenceSnapshotHash: context.currentSnapshotHash,
    });
    return {
      decision: "BLOCKED" as const,
      published: false,
      failed: evaluation.failed,
    };
  }

  try {
    const story = await repository.publishApprovedCandidateAtomically({
      context,
      policyVersion: evaluation.policyVersion,
      gateSnapshot: snapshot,
      audit,
    });
    return {
      decision: "PUBLISHED" as const,
      published: true,
      storyId: story.id,
      urlPath: story.urlPath,
      failed: [],
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_FAILURE";
    await repository.createSystemAlert({
      alertType: "GROK_AUTO_PUBLICATION_FAILED_CLOSED",
      severity: "CRITICAL",
      candidateId,
      detail: "Automatic publication failed closed after server policy evaluation.",
      metadata: { code, policyVersion: evaluation.policyVersion },
    });
    return {
      decision: "BLOCKED" as const,
      published: false,
      failed: [
        {
          gate: "atomicPublication",
          reason: "The final atomic publication recheck failed closed.",
        },
      ],
    };
  }
}
