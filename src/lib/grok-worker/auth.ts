import "server-only";

import { grokTokenPepper, grokWorkerEnvironment } from "./config";
import { safeEqualHex, tokenDigest } from "./crypto";
import type { GrokScope } from "./schemas";

export type WorkerCredentialRecord = {
  credentialId: string;
  workerId: string;
  tokenDigest: string;
  tokenVersion: number;
  credentialExpiresAt: Date;
  credentialRevokedAt: Date | null;
  scopes: string[];
  workerStatus: "ACTIVE" | "DISABLED" | "REVOKED";
  workerEnvironment: string;
  workerTokenVersion: number;
  workerRevokedAt: Date | null;
};

export type GrokWorkerPrincipal = {
  credentialId: string;
  workerId: string;
  scopes: GrokScope[];
  tokenVersion: number;
};

export class GrokWorkerAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = "Worker authentication failed.",
  ) {
    super(message);
  }
}
export type WorkerCredentialRepository = {
  findCredentialByPrefix(prefix: string): Promise<WorkerCredentialRecord | null>;
  touchCredential(credentialId: string, workerId: string): Promise<void>;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(gwk_[a-z0-9]{12}\.[A-Za-z0-9_-]{40,})$/.exec(
    authorization,
  );
  if (!match) throw new GrokWorkerAuthError(401, "UNAUTHORIZED");
  return match[1];
}

export async function authenticateGrokWorker(
  request: Request,
  repository: WorkerCredentialRepository,
): Promise<GrokWorkerPrincipal> {
  const token = bearerToken(request);
  const prefix = token.slice(0, token.indexOf("."));
  const record = await repository.findCredentialByPrefix(prefix);
  const calculatedDigest = tokenDigest(token, grokTokenPepper());

  if (!record || !safeEqualHex(calculatedDigest, record.tokenDigest)) {
    throw new GrokWorkerAuthError(401, "UNAUTHORIZED");
  }

  const now = new Date();
  if (
    record.credentialRevokedAt ||
    record.workerRevokedAt ||
    record.credentialExpiresAt <= now ||
    record.workerStatus !== "ACTIVE" ||
    record.tokenVersion !== record.workerTokenVersion ||
    record.workerEnvironment !== grokWorkerEnvironment()
  ) {
    throw new GrokWorkerAuthError(401, "UNAUTHORIZED");
  }

  await repository.touchCredential(record.credentialId, record.workerId);
  return {
    credentialId: record.credentialId,
    workerId: record.workerId,
    scopes: record.scopes as GrokScope[],
    tokenVersion: record.tokenVersion,
  };
}

export function requireGrokScope(
  principal: GrokWorkerPrincipal,
  scope: GrokScope,
) {
  if (!principal.scopes.includes(scope)) {
    throw new GrokWorkerAuthError(403, "INSUFFICIENT_SCOPE", "Access denied.");
  }
}
