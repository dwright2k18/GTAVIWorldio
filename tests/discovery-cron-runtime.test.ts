import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  prepareRuntimeDatabase: vi.fn(),
  releaseLock: vi.fn(),
  runSource: vi.fn(),
  runWithDatabase: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { select: mocks.select },
  runWithDatabase: mocks.runWithDatabase,
}));
vi.mock("@/db/runtime-connection", () => ({
  prepareRuntimeDatabase: mocks.prepareRuntimeDatabase,
}));
vi.mock("@/lib/discovery/execution-lock", () => ({
  acquireDiscoveryCycleLock: mocks.acquireLock,
  releaseDiscoveryCycleLock: mocks.releaseLock,
}));
vi.mock("@/lib/discovery/ingestion", () => ({
  runDiscoverySource: mocks.runSource,
}));

import { GET } from "@/app/api/cron/discovery/route";

function request(authorization?: string) {
  return new Request("https://gtaviworld.io/api/cron/discovery", {
    headers: authorization ? { authorization } : undefined,
  }) as never;
}

function controlRead(enabled: boolean) {
  return {
    from: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue([{ enabled }]),
    })),
  };
}

function sourceConfigRead(rows: Array<{ id: string; active: boolean }>) {
  return { from: vi.fn().mockResolvedValue(rows) };
}

function dueSourceRead(result: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => result),
        })),
      })),
    })),
  };
}

function authTimeout() {
  return Object.assign(new Error("(EAUTHQUERY) auth_query secret check timed out"), {
    code: "XX000",
  });
}

describe("discovery Cron runtime database safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "runtime-test-secret");
    vi.stubEnv("DISCOVERY_RECURRING_ENABLED", "true");
    mocks.acquireLock.mockResolvedValue("lock-token");
    mocks.releaseLock.mockResolvedValue(true);
    mocks.prepareRuntimeDatabase.mockResolvedValue({
      database: { name: "runtime-database" },
      connectionKind: "transaction_pooler",
      attempts: 1,
      failoverUsed: false,
      failureCodes: [],
    });
    mocks.runWithDatabase.mockImplementation((_database, operation) => operation());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("rejects missing Cron authentication before database preparation", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.prepareRuntimeDatabase).not.toHaveBeenCalled();
  });

  it("rejects invalid Cron authentication before database preparation", async () => {
    const response = await GET(request("Bearer wrong"));
    expect(response.status).toBe(401);
    expect(mocks.prepareRuntimeDatabase).not.toHaveBeenCalled();
  });

  it("validates control read, lock lifecycle, and source configuration while monitoring is off", async () => {
    mocks.select
      .mockReturnValueOnce(controlRead(false))
      .mockReturnValueOnce(sourceConfigRead([
        { id: "one", active: false },
        { id: "two", active: false },
      ]));

    const response = await GET(request("Bearer runtime-test-secret"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      databaseConnectivity: "READY",
      configuredSources: 2,
      activeSources: 0,
      sourceFetches: 0,
      lockValidation: "ACQUIRED_AND_RELEASED",
    });
    expect(mocks.acquireLock).toHaveBeenCalledOnce();
    expect(mocks.releaseLock).toHaveBeenCalledWith("lock-token");
    expect(mocks.runSource).not.toHaveBeenCalled();
  });

  it("fails closed before locking when no runtime database endpoint is available", async () => {
    mocks.prepareRuntimeDatabase.mockRejectedValue(authTimeout());
    const response = await GET(request("Bearer runtime-test-secret"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    expect(mocks.acquireLock).not.toHaveBeenCalled();
    expect(mocks.runSource).not.toHaveBeenCalled();
  });

  it("acquires and releases the lock with zero fetches when monitoring is enabled but no source is due", async () => {
    mocks.select
      .mockReturnValueOnce(controlRead(true))
      .mockReturnValueOnce(sourceConfigRead([]))
      .mockReturnValueOnce(dueSourceRead(Promise.resolve([])));

    const response = await GET(request("Bearer runtime-test-secret"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sourcesChecked: 0,
      publishing: false,
      lockValidation: "ACQUIRED_AND_RELEASED",
    });
    expect(mocks.runSource).not.toHaveBeenCalled();
    expect(mocks.releaseLock).toHaveBeenCalledWith("lock-token");
  });

  it("releases the lock and avoids connector classification when a database outage occurs", async () => {
    mocks.select
      .mockReturnValueOnce(controlRead(true))
      .mockReturnValueOnce(sourceConfigRead([{ id: "official", active: true }]))
      .mockReturnValueOnce(dueSourceRead(Promise.resolve([
        { id: "official", name: "Official source" },
      ])));
    mocks.runSource.mockRejectedValue(authTimeout());

    const response = await GET(request("Bearer runtime-test-secret"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    expect(mocks.releaseLock).toHaveBeenCalledWith("lock-token");
    expect(mocks.runSource).toHaveBeenCalledOnce();
  });
});
