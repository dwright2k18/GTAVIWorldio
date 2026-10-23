import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  authenticateGrokWorker,
  GrokWorkerAuthError,
  requireGrokScope,
  type GrokWorkerPrincipal,
} from "./auth";
import { grokWorkerApiEnvironmentEnabled } from "./config";
import { hashPayload } from "./crypto";
import { GrokWorkerRepository } from "./repository";
import type { GrokScope } from "./schemas";

export const grokRepository = new GrokWorkerRepository();

export class GrokApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type AuthorizedGrokRequest = {
  principal: GrokWorkerPrincipal;
  requestId: string;
};

const rateLimits: Record<GrokScope, number> = {
  "worker:status": 30,
  "queue:lease": 12,
  "candidate:read-leased": 30,
  "artifact:submit": 10,
  "job:complete": 5,
  "exception:write": 10,
};

export async function authorizeGrokRequest(
  request: Request,
  scope: GrokScope,
): Promise<AuthorizedGrokRequest> {
  if (!grokWorkerApiEnvironmentEnabled()) {
    throw new GrokApiError(503, "WORKER_API_DISABLED", "Worker API unavailable.");
  }

  const principal = await authenticateGrokWorker(request, grokRepository);
  requireGrokScope(principal, scope);
  const controls = await grokRepository.controls();
  if (!controls?.apiEnabled || controls.emergencyStop) {
    throw new GrokApiError(503, "WORKER_API_DISABLED", "Worker API unavailable.");
  }

  const count = await grokRepository.consumeRateLimit(
    principal.workerId,
    scope,
    rateLimits[scope],
  );
  if (count === null) {
    throw new GrokApiError(429, "RATE_LIMITED", "Request limit exceeded.");
  }
  return { principal, requestId: request.headers.get("x-request-id") ?? randomUUID() };
}

export async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1_000_000) {
    throw new GrokApiError(413, "PAYLOAD_TOO_LARGE", "Payload exceeds 1 MB.");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 1_000_000) {
    throw new GrokApiError(413, "PAYLOAD_TOO_LARGE", "Payload exceeds 1 MB.");
  }
  try {
    return text ? (JSON.parse(text) as unknown) : {};
  } catch {
    throw new GrokApiError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
}

export function leaseTokenFrom(request: Request) {
  const token = request.headers.get("x-grok-lease-token")?.trim();
  if (!token || !/^[A-Za-z0-9_-]{40,}$/.test(token)) {
    throw new GrokApiError(409, "ACTIVE_LEASE_REQUIRED", "Active lease required.");
  }
  return token;
}

export function idempotencyKeyFrom(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || !/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
    throw new GrokApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid Idempotency-Key header is required.",
    );
  }
  return key;
}

export async function replayOrRun(
  request: Request,
  principal: GrokWorkerPrincipal,
  routeKey: string,
  input: unknown,
  operation: (idempotencyRecordId: string) => Promise<{
    status: number;
    body: Record<string, unknown>;
    storedBody?: Record<string, unknown>;
  }>,
  options?: {
    hydrateReplay?: (
      storedBody: Record<string, unknown>,
      idempotencyRecordId: string,
    ) => Record<string, unknown>;
  },
) {
  const idempotencyKey = idempotencyKeyFrom(request);
  const requestHash = hashPayload(input);
  const claim = await grokRepository.claimIdempotency({
    credentialId: principal.credentialId,
    routeKey,
    idempotencyKey,
    requestHash,
  });
  if (!claim) {
    const previous = await grokRepository.findIdempotentResponse(
      principal.credentialId,
      routeKey,
      idempotencyKey,
    );
    if (!previous) {
      throw new GrokApiError(409, "IDEMPOTENCY_RACE", "Request is already being processed.");
    }
    if (previous.requestHash !== requestHash) {
      throw new GrokApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The idempotency key was already used with different content.",
      );
    }
    if (previous.responseStatus === 102) {
      throw new GrokApiError(409, "REQUEST_IN_PROGRESS", "Request is already being processed.");
    }
    return Response.json(
      options?.hydrateReplay
        ? options.hydrateReplay(previous.responseBody, previous.id)
        : previous.responseBody,
      {
      status: previous.responseStatus,
      headers: { "x-idempotent-replay": "true" },
      },
    );
  }

  try {
    const result = await operation(claim.id);
    await grokRepository.finalizeIdempotency({
      id: claim.id,
      responseStatus: result.status,
      responseBody: result.storedBody ?? result.body,
    });
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    await grokRepository.finalizeIdempotency({
      id: claim.id,
      responseStatus: 500,
      responseBody: {
        error: {
          code: "FAILED_CLOSED",
          message: "The original request failed and was not replayed.",
        },
      },
    });
    throw error;
  }
}

export function grokErrorResponse(error: unknown) {
  if (error instanceof GrokWorkerAuthError || error instanceof GrokApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: error.status === 429 ? { "retry-after": "60" } : undefined,
      },
    );
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: "SCHEMA_VALIDATION_FAILED",
          message: "The submitted structure is invalid.",
          findings: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof Error) {
    const mappings: Record<string, [number, string]> = {
      ACTIVE_LEASE_REQUIRED: [409, "Active lease required."],
      EVIDENCE_SNAPSHOT_CHANGED: [409, "The evidence snapshot changed."],
      WORK_CONTEXT_NOT_FOUND: [404, "Work item context was not found."],
      ACCEPTED_ARTIFACT_REQUIRED: [422, "An accepted artifact is required."],
      WORK_REVISION_MISMATCH: [409, "The work-item revision changed."],
      CANDIDATE_CONTEXT_MISMATCH: [409, "The candidate context does not match the lease."],
      ARTIFACT_NOT_ALLOWED_FOR_WORK_KIND: [422, "This artifact is not allowed for the leased work kind."],
      REQUIRED_ARTIFACTS_MISSING: [422, "The leased work item is missing required artifacts."],
    };
    const mapped = mappings[error.message];
    if (mapped) {
      return Response.json(
        { error: { code: error.message, message: mapped[1] } },
        { status: mapped[0] },
      );
    }
  }
  console.error("Grok Worker API request failed", {
    error: error instanceof Error ? error.message : "unknown",
  });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Request failed safely." } },
    { status: 500 },
  );
}
