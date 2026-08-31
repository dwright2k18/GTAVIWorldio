import { describe, expect, it } from "vitest";

import {
  CONNECTOR_DUE_TOLERANCE_MS,
  connectorCadenceDecision,
  nextScheduledConnectorCheck,
  scheduledDueAfterConnectorFailure,
} from "@/lib/discovery/cadence";

const due = new Date("2026-08-25T22:00:00.000Z");

function decision(now: string, options?: { nextCheckAt?: Date | null; lastCheckedAt?: Date | null }) {
  return connectorCadenceDecision({
    nextCheckAt: options?.nextCheckAt === undefined ? due : options.nextCheckAt,
    lastCheckedAt: options?.lastCheckedAt ?? null,
    now: new Date(now),
  });
}

function nextCheck(options: {
  previousScheduledDueAt?: Date | null;
  runStartedAt: string;
  completedAt: string;
  intervalMinutes?: number;
}) {
  return nextScheduledConnectorCheck({
    previousScheduledDueAt: options.previousScheduledDueAt === undefined
      ? due
      : options.previousScheduledDueAt,
    runStartedAt: new Date(options.runStartedAt),
    completedAt: new Date(options.completedAt),
    intervalMinutes: options.intervalMinutes ?? 120,
  });
}

describe("official connector UTC cadence", () => {
  it("runs a connector due exactly at the Cron boundary", () => {
    expect(decision("2026-08-25T22:00:00.000Z")).toEqual({ due: true, reason: "DUE" });
  });

  it("runs when legacy completion timing left the due time a few seconds after the boundary", () => {
    const legacyDue = new Date("2026-08-25T22:00:05.000Z");
    expect(decision("2026-08-25T22:00:03.000Z", { nextCheckAt: legacyDue }))
      .toEqual({ due: true, reason: "DUE" });
  });

  it("runs normally when the Cron invocation is slightly delayed", () => {
    expect(decision("2026-08-25T22:00:20.000Z")).toEqual({ due: true, reason: "DUE" });
    expect(nextCheck({
      runStartedAt: "2026-08-25T22:00:20.000Z",
      completedAt: "2026-08-25T22:00:28.000Z",
    }).toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("allows a slightly early invocation only inside the bounded tolerance", () => {
    expect(decision("2026-08-25T21:59:45.000Z")).toEqual({ due: true, reason: "DUE" });
    expect(decision(new Date(due.valueOf() - CONNECTOR_DUE_TOLERANCE_MS - 1).toISOString()))
      .toEqual({ due: false, reason: "TOO_EARLY" });
  });

  it("suppresses a duplicate delivery after the scheduled due time advances", () => {
    const next = nextCheck({
      runStartedAt: "2026-08-25T21:59:55.000Z",
      completedAt: "2026-08-25T22:00:08.000Z",
    });
    expect(next.toISOString()).toBe("2026-08-26T00:00:00.000Z");
    expect(decision("2026-08-25T22:00:09.000Z", { nextCheckAt: next }))
      .toEqual({ due: false, reason: "TOO_EARLY" });
  });

  it("advances one missed Cron cycle without replaying the missed execution", () => {
    expect(nextCheck({
      previousScheduledDueAt: new Date("2026-08-25T18:00:00.000Z"),
      runStartedAt: "2026-08-25T22:00:03.000Z",
      completedAt: "2026-08-25T22:00:10.000Z",
    }).toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("skips multiple elapsed intervals without creating a catch-up burst", () => {
    expect(nextCheck({
      previousScheduledDueAt: new Date("2026-08-25T10:00:00.000Z"),
      runStartedAt: "2026-08-25T22:00:03.000Z",
      completedAt: "2026-08-25T22:00:10.000Z",
      intervalMinutes: 360,
    }).toISOString()).toBe("2026-08-26T04:00:00.000Z");
  });

  it("preserves the established due time after failure while suppressing immediate redelivery", () => {
    const failedAt = new Date("2026-08-25T22:00:08.000Z");
    const preservedDue = scheduledDueAfterConnectorFailure(due);
    expect(preservedDue?.toISOString()).toBe(due.toISOString());
    expect(decision("2026-08-25T22:00:12.000Z", {
      nextCheckAt: preservedDue,
      lastCheckedAt: failedAt,
    })).toEqual({ due: false, reason: "RECENT_ATTEMPT" });
    expect(decision("2026-08-26T00:00:03.000Z", {
      nextCheckAt: preservedDue,
      lastCheckedAt: failedAt,
    })).toEqual({ due: true, reason: "DUE" });
  });

  it("establishes UTC-aligned 120, 240, and 360-minute schedules", () => {
    for (const [intervalMinutes, expected] of [
      [120, "2026-08-26T00:00:00.000Z"],
      [240, "2026-08-26T02:00:00.000Z"],
      [360, "2026-08-26T04:00:00.000Z"],
    ] as const) {
      expect(nextCheck({
        previousScheduledDueAt: null,
        runStartedAt: "2026-08-25T22:00:03.000Z",
        completedAt: "2026-08-25T22:00:09.000Z",
        intervalMinutes,
      }).toISOString()).toBe(expected);
    }
  });

  it("keeps UTC cadence stable across daylight-saving transitions", () => {
    expect(nextCheck({
      previousScheduledDueAt: new Date("2026-03-08T06:00:00.000Z"),
      runStartedAt: "2026-03-08T06:00:03.000Z",
      completedAt: "2026-03-08T06:00:09.000Z",
    }).toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(nextCheck({
      previousScheduledDueAt: new Date("2026-11-01T05:00:00.000Z"),
      runStartedAt: "2026-11-01T05:00:03.000Z",
      completedAt: "2026-11-01T05:00:09.000Z",
    }).toISOString()).toBe("2026-11-01T07:00:00.000Z");
  });
});
