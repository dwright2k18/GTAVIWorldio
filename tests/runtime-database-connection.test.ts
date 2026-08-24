import { describe, expect, it, vi } from "vitest";

import type { RuntimeDatabaseCandidate } from "@/db/connection-url";
import {
  databaseOperationalCode,
  isDatabaseAvailabilityError,
} from "@/db/errors";
import { selectRuntimeConnection } from "@/db/runtime-connection-policy";

const candidates: RuntimeDatabaseCandidate[] = [
  { kind: "transaction_pooler", url: "postgres://primary.example/db" },
  { kind: "session_or_direct_fallback", url: "postgres://fallback.example/db" },
];

function authTimeout() {
  return Object.assign(new Error("(EAUTHQUERY) auth_query secret check timed out"), {
    code: "XX000",
  });
}

describe("runtime database connection policy", () => {
  it("uses the transaction pooler when its probe succeeds", async () => {
    const probe = vi.fn().mockResolvedValue("primary");
    const selected = await selectRuntimeConnection(candidates, {
      probe,
      isTransient: isDatabaseAvailabilityError,
      sleep: vi.fn(),
    });

    expect(selected).toMatchObject({
      connection: "primary",
      attempts: 1,
      failoverUsed: false,
      failureCodes: [],
    });
    expect(probe).toHaveBeenCalledOnce();
  });

  it("retries the primary once using a bounded delay", async () => {
    const probe = vi.fn()
      .mockRejectedValueOnce(authTimeout())
      .mockResolvedValueOnce("fresh-primary");
    const sleep = vi.fn().mockResolvedValue(undefined);
    const selected = await selectRuntimeConnection(candidates, {
      probe,
      isTransient: isDatabaseAvailabilityError,
      sleep,
    });

    expect(selected).toMatchObject({
      connection: "fresh-primary",
      attempts: 2,
      failoverUsed: false,
      failureCodes: ["EAUTHQUERY"],
    });
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("uses the approved alternate only after two transient primary failures", async () => {
    const probe = vi.fn()
      .mockRejectedValueOnce(authTimeout())
      .mockRejectedValueOnce(authTimeout())
      .mockResolvedValueOnce("fallback");
    const selected = await selectRuntimeConnection(candidates, {
      probe,
      isTransient: isDatabaseAvailabilityError,
      sleep: vi.fn(),
    });

    expect(selected).toMatchObject({
      connection: "fallback",
      attempts: 3,
      failoverUsed: true,
      failureCodes: ["EAUTHQUERY", "EAUTHQUERY"],
    });
    expect(probe.mock.calls[2]?.[0]).toEqual(candidates[1]);
  });

  it("does not retry authorization, SQL, or programming errors", async () => {
    const syntaxError = Object.assign(new Error("Invalid SQL"), { code: "42601" });
    const probe = vi.fn().mockRejectedValue(syntaxError);

    await expect(selectRuntimeConnection(candidates, {
      probe,
      isTransient: isDatabaseAvailabilityError,
      sleep: vi.fn(),
    })).rejects.toBe(syntaxError);
    expect(probe).toHaveBeenCalledOnce();
  });

  it("recognizes nested Supavisor authentication timeouts without treating XX000 broadly", () => {
    expect(isDatabaseAvailabilityError({ cause: authTimeout() })).toBe(true);
    expect(databaseOperationalCode({ cause: authTimeout() })).toBe("EAUTHQUERY");
    expect(isDatabaseAvailabilityError(Object.assign(new Error("Internal database error"), {
      code: "XX000",
    }))).toBe(false);
  });
});
