import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  candidateEvidence,
  discoveryCandidates,
  grokAutomationControls,
  grokAuditEvents,
  grokWorkItems,
  monitoredSources,
} from "@/db/schema";
import type { EditorRole } from "@/lib/auth/dal";
import { grokCandidateSnapshotHash } from "./snapshot";

export type GrokWorkKind =
  | "RESEARCH"
  | "DRAFT"
  | "FACT_CHECK"
  | "SEO"
  | "PRIMARY_VIDEO"
  | "QUICK_HIT"
  | "REVISION";

const enqueueRoles: EditorRole[] = ["OWNER", "ADMIN", "EDITOR"];
const eligibleCandidateStatuses = ["DISCOVERED", "TRIAGED", "RESEARCHING"] as const;

export async function enqueueCandidateForGrok(input: {
  candidateId: string;
  kind: GrokWorkKind;
  actor: { id: string; role: EditorRole };
  priority?: number;
  revision?: number;
  parentWorkItemId?: string;
  notBefore?: Date;
}) {
  if (!enqueueRoles.includes(input.actor.role)) {
    throw new Error("Your newsroom role cannot enqueue Grok work.");
  }

  return db.transaction(async (tx) => {
    const [controls] = await tx
      .select()
      .from(grokAutomationControls)
      .where(eq(grokAutomationControls.singleton, true))
      .limit(1);
    if (!controls?.apiEnabled || !controls.queueEnabled || controls.emergencyStop) {
      throw new Error("Grok work queue is disabled.");
    }

    const [record] = await tx
      .select({ candidate: discoveryCandidates, source: monitoredSources })
      .from(discoveryCandidates)
      .innerJoin(monitoredSources, eq(discoveryCandidates.sourceId, monitoredSources.id))
      .where(
        and(
          eq(discoveryCandidates.id, input.candidateId),
          eq(discoveryCandidates.isTest, false),
          inArray(discoveryCandidates.status, eligibleCandidateStatuses),
        ),
      )
      .limit(1);
    if (!record || record.candidate.storyId) {
      throw new Error("Candidate is not eligible for private worker processing.");
    }

    const evidence = await tx
      .select({
        id: candidateEvidence.id,
        sourceId: candidateEvidence.sourceId,
        sourceUrl: candidateEvidence.sourceUrl,
        authorityTier: candidateEvidence.authorityTier,
        extractedFacts: candidateEvidence.extractedFacts,
        exactQuotes: candidateEvidence.exactQuotes,
        rightsNotes: candidateEvidence.rightsNotes,
        updatedAt: candidateEvidence.updatedAt,
      })
      .from(candidateEvidence)
      .where(eq(candidateEvidence.candidateId, input.candidateId))
      .orderBy(candidateEvidence.id);
    if (!evidence.length) {
      throw new Error("Candidate requires stored evidence before worker processing.");
    }

    const inputSnapshotHash = grokCandidateSnapshotHash({
      candidate: {
        id: record.candidate.id,
        status: record.candidate.status,
        duplicateStatus: record.candidate.duplicateStatus,
        verificationRecommendation: record.candidate.verificationRecommendation,
        confidenceScore: record.candidate.confidenceScore,
        conflictingClaims: record.candidate.conflictingClaims,
        mediaRightsStatus: record.candidate.mediaRightsStatus,
        sourceUrl: record.candidate.sourceUrl,
      },
      source: {
        id: record.source.id,
        authorityTier: record.source.authorityTier,
        isFirstParty: record.source.isFirstParty,
        url: record.source.url,
      },
      evidence,
    });
    const revision = input.revision ?? 1;
    const [workItem] = await tx
      .insert(grokWorkItems)
      .values({
        candidateId: input.candidateId,
        kind: input.kind,
        priority: Math.max(-100, Math.min(100, input.priority ?? 0)),
        notBefore: input.notBefore ?? new Date(),
        inputSnapshotHash,
        revision,
        parentWorkItemId: input.parentWorkItemId,
        createdBy: input.actor.id,
      })
      .returning({ id: grokWorkItems.id, status: grokWorkItems.status });
    await tx.insert(grokAuditEvents).values({
      workItemId: workItem.id,
      candidateId: input.candidateId,
      action: "GROK_WORK_ENQUEUED",
      requestId: randomUUID(),
      requestHash: inputSnapshotHash,
      outcome: "READY",
      metadata: {
        kind: input.kind,
        revision,
        actorId: input.actor.id,
        actorRole: input.actor.role,
      },
    });
    return { ...workItem, inputSnapshotHash, revision };
  });
}
