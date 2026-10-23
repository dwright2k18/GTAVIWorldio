import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  grokAutomationControls,
  grokAuditEvents,
  grokWorkerCredentials,
  grokWorkers,
  grokWorkItems,
  grokWorkLeases,
} from "@/db/schema";
import type { EditorRole } from "@/lib/auth/dal";
import { grokTokenPepper } from "./config";
import { generateOpaqueWorkerToken, tokenDigest } from "./crypto";
import { grokScopeSchema, type GrokScope } from "./schemas";

function assertCredentialAdministrator(role: EditorRole) {
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new Error("Only an owner or administrator may manage worker credentials.");
  }
}

function validateScopes(scopes: GrokScope[]) {
  const unique = [...new Set(scopes)].map((scope) => grokScopeSchema.parse(scope));
  if (!unique.length) throw new Error("At least one least-privilege scope is required.");
  return unique;
}

export async function issueGrokWorkerCredential(input: {
  workerId: string;
  scopes: GrokScope[];
  expiresAt: Date;
  actor: { id: string; role: EditorRole };
  rotatedFromId?: string;
}) {
  assertCredentialAdministrator(input.actor.role);
  if (input.expiresAt <= new Date()) throw new Error("Credential expiry must be in the future.");
  if (input.expiresAt.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1_000) {
    throw new Error("Worker credentials may not remain valid for more than 90 days.");
  }
  const scopes = validateScopes(input.scopes);
  const { prefix: tokenPrefix, token: plaintextToken } = generateOpaqueWorkerToken();

  const credential = await db.transaction(async (tx) => {
    const [worker] = await tx
      .select()
      .from(grokWorkers)
      .where(eq(grokWorkers.id, input.workerId))
      .limit(1);
    if (!worker || worker.status === "REVOKED" || worker.revokedAt) {
      throw new Error("Worker is not eligible for a new credential.");
    }
    if (input.rotatedFromId) {
      const [previous] = await tx
        .select({ id: grokWorkerCredentials.id })
        .from(grokWorkerCredentials)
        .where(
          and(
            eq(grokWorkerCredentials.id, input.rotatedFromId),
            eq(grokWorkerCredentials.workerId, worker.id),
            isNull(grokWorkerCredentials.revokedAt),
          ),
        )
        .limit(1);
      if (!previous) throw new Error("The credential selected for rotation is not active.");
    }
    const [created] = await tx
      .insert(grokWorkerCredentials)
      .values({
        workerId: worker.id,
        tokenPrefix,
        tokenDigest: tokenDigest(plaintextToken, grokTokenPepper()),
        scopes,
        tokenVersion: worker.tokenVersion,
        expiresAt: input.expiresAt,
        rotatedFromId: input.rotatedFromId,
      })
      .returning({ id: grokWorkerCredentials.id, expiresAt: grokWorkerCredentials.expiresAt });
    if (input.rotatedFromId) {
      await tx
        .update(grokWorkerCredentials)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(grokWorkerCredentials.id, input.rotatedFromId),
            eq(grokWorkerCredentials.workerId, worker.id),
            isNull(grokWorkerCredentials.revokedAt),
          ),
        );
    }
    await tx.insert(grokAuditEvents).values({
      workerId: worker.id,
      credentialId: created.id,
      action: input.rotatedFromId
        ? "GROK_CREDENTIAL_ROTATED"
        : "GROK_CREDENTIAL_ISSUED",
      requestId: randomUUID(),
      outcome: "SUCCESS",
      metadata: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        scopes,
        expiresAt: created.expiresAt.toISOString(),
      },
    });
    return created;
  });

  return {
    credential,
    plaintextToken,
    warning: "This token is returned once. Store it in an approved secret manager.",
  };
}

export async function createDisabledGrokWorker(input: {
  name: string;
  environment: "production" | "preview" | "development";
  actor: { id: string; role: EditorRole };
}) {
  assertCredentialAdministrator(input.actor.role);
  const name = input.name.trim();
  if (!name || name.length > 120) throw new Error("Worker name is invalid.");
  return db.transaction(async (tx) => {
    const [worker] = await tx
      .insert(grokWorkers)
      .values({
        name,
        environment: input.environment,
        status: "DISABLED",
        maxConcurrentLeases: 1,
        createdBy: input.actor.id,
      })
      .returning({ id: grokWorkers.id, status: grokWorkers.status });
    await tx.insert(grokAuditEvents).values({
      workerId: worker.id,
      action: "GROK_WORKER_CREATED_DISABLED",
      requestId: randomUUID(),
      outcome: "DISABLED",
      metadata: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        environment: input.environment,
      },
    });
    return worker;
  });
}

export async function setGrokEmergencyStop(input: {
  active: boolean;
  actor: { id: string; role: EditorRole };
  reason: string;
}) {
  assertCredentialAdministrator(input.actor.role);
  await db.transaction(async (tx) => {
    await tx
      .update(grokAutomationControls)
      .set({
        emergencyStop: input.active,
        updatedBy: input.actor.id,
        updatedAt: new Date(),
      })
      .where(eq(grokAutomationControls.singleton, true));
    let releasedWorkItems = 0;
    if (input.active) {
      const releasedLeases = await tx
        .update(grokWorkLeases)
        .set({
          releasedAt: new Date(),
          releaseReason: "EMERGENCY_STOP",
        })
        .where(isNull(grokWorkLeases.releasedAt))
        .returning({ workItemId: grokWorkLeases.workItemId });
      const workItemIds = releasedLeases.map((lease) => lease.workItemId);
      releasedWorkItems = workItemIds.length;
      if (workItemIds.length) {
        await tx
          .update(grokWorkItems)
          .set({ status: "READY", updatedAt: new Date() })
          .where(inArray(grokWorkItems.id, workItemIds));
      }
    }
    await tx.insert(grokAuditEvents).values({
      action: input.active
        ? "GROK_EMERGENCY_STOP_ENABLED"
        : "GROK_EMERGENCY_STOP_DISABLED",
      requestId: randomUUID(),
      outcome: input.active ? "STOPPED" : "READY_FOR_SEPARATE_ACTIVATION",
      metadata: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        reason: input.reason.slice(0, 500),
        releasedWorkItems,
      },
    });
  });
}

export async function revokeGrokWorker(input: {
  workerId: string;
  actor: { id: string; role: EditorRole };
  reason: string;
}) {
  assertCredentialAdministrator(input.actor.role);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(grokWorkers)
      .set({
        status: "REVOKED",
        revokedAt: now,
        tokenVersion: sql`${grokWorkers.tokenVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(grokWorkers.id, input.workerId));
    await tx
      .update(grokWorkerCredentials)
      .set({ revokedAt: now })
      .where(
        and(
          eq(grokWorkerCredentials.workerId, input.workerId),
          isNull(grokWorkerCredentials.revokedAt),
        ),
      );
    const releasedLeases = await tx
      .update(grokWorkLeases)
      .set({
        releasedAt: now,
        releaseReason: "WORKER_REVOKED",
      })
      .where(
        and(
          eq(grokWorkLeases.workerId, input.workerId),
          isNull(grokWorkLeases.releasedAt),
        ),
      )
      .returning({ workItemId: grokWorkLeases.workItemId });
    const releasedWorkItemIds = releasedLeases.map((lease) => lease.workItemId);
    if (releasedWorkItemIds.length) {
      await tx
        .update(grokWorkItems)
        .set({ status: "READY", updatedAt: now })
        .where(inArray(grokWorkItems.id, releasedWorkItemIds));
    }
    await tx.insert(grokAuditEvents).values({
      workerId: input.workerId,
      action: "GROK_WORKER_REVOKED",
      requestId: randomUUID(),
      outcome: "SUCCESS",
      metadata: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        reason: input.reason.slice(0, 500),
        releasedWorkItems: releasedWorkItemIds.length,
      },
    });
  });
}
