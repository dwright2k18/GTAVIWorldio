import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("request-scoped database context", () => {
  it("routes concurrent async work to its selected database", async () => {
    const { db, runWithDatabase } = await import("@/db");
    const databaseA = { select: vi.fn(() => "A") } as unknown as typeof db;
    const databaseB = { select: vi.fn(() => "B") } as unknown as typeof db;

    const [resultA, resultB] = await Promise.all([
      runWithDatabase(databaseA, async () => {
        await Promise.resolve();
        return db.select();
      }),
      runWithDatabase(databaseB, async () => {
        await Promise.resolve();
        return db.select();
      }),
    ]);

    expect(resultA).toBe("A");
    expect(resultB).toBe("B");
    expect(databaseA.select).toHaveBeenCalledOnce();
    expect(databaseB.select).toHaveBeenCalledOnce();
  });
});
