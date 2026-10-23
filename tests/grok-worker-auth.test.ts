import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  authenticateGrokWorker,
  requireGrokScope,
  type WorkerCredentialRecord,
  type WorkerCredentialRepository,
} from "@/lib/grok-worker/auth";
import {
  deriveLeaseToken,
  generateOpaqueWorkerToken,
  tokenDigest,
} from "@/lib/grok-worker/crypto";

const pepper = "test-pepper-that-is-longer-than-thirty-two-characters";

function repository(record: WorkerCredentialRecord | null) {
  return {
    findCredentialByPrefix: vi.fn(async () => record),
    touchCredential: vi.fn(async () => undefined),
  } satisfies WorkerCredentialRepository;
}

afterEach(() => vi.unstubAllEnvs());

describe("Grok worker authentication", () => {
  it("authenticates an active, correctly scoped, environment-bound token", async () => {
    vi.stubEnv("GROK_WORKER_TOKEN_PEPPER", pepper);
    vi.stubEnv("VERCEL_ENV", "production");
    const { prefix, token } = generateOpaqueWorkerToken();
    const record: WorkerCredentialRecord = {
      credentialId: "10000000-0000-4000-8000-000000000001",
      workerId: "10000000-0000-4000-8000-000000000002",
      tokenDigest: tokenDigest(token, pepper),
      tokenVersion: 1,
      credentialExpiresAt: new Date(Date.now() + 60_000),
      credentialRevokedAt: null,
      scopes: ["queue:lease"],
      workerStatus: "ACTIVE",
      workerEnvironment: "production",
      workerTokenVersion: 1,
      workerRevokedAt: null,
    };
    const repo = repository(record);
    const principal = await authenticateGrokWorker(
      new Request("https://example.test", {
        headers: { authorization: `Bearer ${token}` },
      }),
      repo,
    );
    expect(principal.workerId).toBe(record.workerId);
    expect(repo.findCredentialByPrefix).toHaveBeenCalledWith(prefix);
    expect(repo.touchCredential).toHaveBeenCalledOnce();
    expect(() => requireGrokScope(principal, "queue:lease")).not.toThrow();
    expect(() => requireGrokScope(principal, "artifact:submit")).toThrow(
      "Access denied.",
    );
  });

  it.each([
    ["revoked credential", { credentialRevokedAt: new Date() }],
    ["revoked worker", { workerStatus: "REVOKED", workerRevokedAt: new Date() }],
    ["expired credential", { credentialExpiresAt: new Date(0) }],
    ["rotated version", { workerTokenVersion: 2 }],
    ["wrong environment", { workerEnvironment: "preview" }],
  ] satisfies Array<[string, Partial<WorkerCredentialRecord>]>) (
    "rejects a %s without disclosing the cause",
    async (_name, patch) => {
      vi.stubEnv("GROK_WORKER_TOKEN_PEPPER", pepper);
      vi.stubEnv("VERCEL_ENV", "production");
      const { token } = generateOpaqueWorkerToken();
      const record: WorkerCredentialRecord = {
        credentialId: "10000000-0000-4000-8000-000000000001",
        workerId: "10000000-0000-4000-8000-000000000002",
        tokenDigest: tokenDigest(token, pepper),
        tokenVersion: 1,
        credentialExpiresAt: new Date(Date.now() + 60_000),
        credentialRevokedAt: null,
        scopes: ["queue:lease"],
        workerStatus: "ACTIVE",
        workerEnvironment: "production",
        workerTokenVersion: 1,
        workerRevokedAt: null,
        ...patch,
      };
      await expect(
        authenticateGrokWorker(
          new Request("https://example.test", {
            headers: { authorization: `Bearer ${token}` },
          }),
          repository(record),
        ),
      ).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Worker authentication failed.",
      });
    },
  );

  it("stores a digest that cannot be used as the bearer token", () => {
    const { token } = generateOpaqueWorkerToken();
    const digest = tokenDigest(token, pepper);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(token);
    expect(token).toMatch(/^gwk_[a-f0-9]{12}\.[A-Za-z0-9_-]{40,}$/);
  });

  it("derives stable high-entropy lease capabilities without storing plaintext", () => {
    const first = deriveLeaseToken("credential:idempotency-key", pepper);
    const replay = deriveLeaseToken("credential:idempotency-key", pepper);
    const other = deriveLeaseToken("credential:other-key", pepper);
    expect(first).toBe(replay);
    expect(first).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(other).not.toBe(first);
  });
});
