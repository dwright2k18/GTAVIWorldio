import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePathMock, sqlClientMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  sqlClientMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/db", () => ({ sqlClient: sqlClientMock }));

import { POST, scheduledPublishingEnabled } from "@/app/api/cron/publish-scheduled/route";
import { recurringDiscoveryEnabled } from "@/lib/discovery/pipeline";

const localTestSecret = "scheduled-publishing-local-test-only";

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/publish-scheduled", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("scheduled publishing authorization gate", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", localTestSecret);
    vi.stubEnv("SCHEDULED_PUBLISHING_ENABLED", "");
    vi.stubEnv("DISCOVERY_RECURRING_ENABLED", "");
    sqlClientMock.mockReset().mockResolvedValue([]);
    revalidatePathMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed before authentication when publishing is disabled", async () => {
    const missing = await POST(request());
    const invalid = await POST(request("Bearer invalid"));
    const valid = await POST(request(`Bearer ${localTestSecret}`));

    expect(missing.status).toBe(503);
    expect(invalid.status).toBe(503);
    expect(valid.status).toBe(503);
    await expect(missing.json()).resolves.toEqual({ error: "Scheduled publishing is disabled." });
    await expect(invalid.json()).resolves.toEqual({ error: "Scheduled publishing is disabled." });
    await expect(valid.json()).resolves.toEqual({ error: "Scheduled publishing is disabled." });
    expect(sqlClientMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects missing cron authentication when the publishing gate is on", async () => {
    vi.stubEnv("SCHEDULED_PUBLISHING_ENABLED", "true");

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(sqlClientMock).not.toHaveBeenCalled();
  });

  it("rejects invalid cron authentication when the publishing gate is on", async () => {
    vi.stubEnv("SCHEDULED_PUBLISHING_ENABLED", "true");

    const response = await POST(request("Bearer invalid"));

    expect(response.status).toBe(401);
    expect(sqlClientMock).not.toHaveBeenCalled();
  });

  it("reaches publishing only when both the gate and cron authentication are valid", async () => {
    vi.stubEnv("SCHEDULED_PUBLISHING_ENABLED", "true");
    sqlClientMock.mockResolvedValue([{ id: "story-id", urlPath: "/news/test-story" }]);

    const response = await POST(request(`Bearer ${localTestSecret}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ published: 1 });
    expect(sqlClientMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/news/test-story");
  });

  it("keeps the publishing and discovery environment gates independent", () => {
    vi.stubEnv("SCHEDULED_PUBLISHING_ENABLED", "true");
    vi.stubEnv("DISCOVERY_RECURRING_ENABLED", "");
    expect(scheduledPublishingEnabled()).toBe(true);
    expect(recurringDiscoveryEnabled()).toBe(false);

    vi.stubEnv("SCHEDULED_PUBLISHING_ENABLED", "");
    vi.stubEnv("DISCOVERY_RECURRING_ENABLED", "true");
    expect(scheduledPublishingEnabled()).toBe(false);
    expect(recurringDiscoveryEnabled()).toBe(true);
  });
});
