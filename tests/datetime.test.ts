import { describe, expect, it } from "vitest";

import { formatDateTimeInZone, parseUtcDateTime, parseZonedDateTime } from "@/lib/cms/datetime";

describe("newsroom date and timezone handling", () => {
  it("stores local newsroom times as UTC across daylight-saving seasons", () => {
    expect(parseZonedDateTime("2026-08-21T10:30", "America/New_York", "Schedule")?.toISOString()).toBe(
      "2026-08-21T14:30:00.000Z",
    );
    expect(parseZonedDateTime("2026-01-21T10:30", "America/New_York", "Schedule")?.toISOString()).toBe(
      "2026-01-21T15:30:00.000Z",
    );
  });

  it("round-trips stored dates into the selected newsroom timezone", () => {
    expect(formatDateTimeInZone(new Date("2026-08-21T14:30:00.000Z"), "America/New_York")).toBe(
      "2026-08-21T10:30",
    );
  });

  it("parses timezone-free source dates consistently as UTC", () => {
    expect(parseUtcDateTime("2026-08-21T10:30", "Source date")?.toISOString()).toBe("2026-08-21T10:30:00.000Z");
  });
});
