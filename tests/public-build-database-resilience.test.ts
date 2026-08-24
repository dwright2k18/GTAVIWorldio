import { describe, expect, it, vi } from "vitest";

import {
  isDatabaseAvailabilityError,
  readPublicCmsWithBuildFallback,
} from "@/lib/cms/public-build-resilience";

const buildEnvironment = { NEXT_PHASE: "phase-production-build" };

function unavailableDatabaseError() {
  return Object.assign(new Error("Public CMS query failed"), {
    cause: Object.assign(new Error("Connection timed out"), {
      code: "CONNECT_TIMEOUT",
    }),
  });
}

describe("public build-time database resilience", () => {
  it("uses approved database content when the database is available during build", async () => {
    const approved = [{ slug: "approved-story", status: "PUBLISHED" }];
    const result = await readPublicCmsWithBuildFallback(
      async () => approved,
      () => [],
      buildEnvironment,
    );

    expect(result).toEqual(approved);
  });

  it("uses the deterministic public fallback when the database is unavailable during build", async () => {
    const fallback = vi.fn(() => [{ title: "Pre-launch information" }]);
    const result = await readPublicCmsWithBuildFallback(
      async () => {
        throw unavailableDatabaseError();
      },
      fallback,
      buildEnvironment,
    );

    expect(result).toEqual([{ title: "Pre-launch information" }]);
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("does not expose unpublished data through the build fallback", async () => {
    const unpublished = [{ slug: "private-draft", status: "DRAFT" }];
    const result = await readPublicCmsWithBuildFallback(
      async () => {
        void unpublished;
        throw unavailableDatabaseError();
      },
      () => [],
      buildEnvironment,
    );

    expect(result).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("private-draft");
  });

  it("keeps runtime database failures fail-closed", async () => {
    const error = unavailableDatabaseError();

    await expect(
      readPublicCmsWithBuildFallback(
        async () => {
          throw error;
        },
        () => [],
        {},
      ),
    ).rejects.toBe(error);
  });

  it("does not hide query, authorization, or programming errors during build", async () => {
    const error = Object.assign(new Error("Invalid SQL"), { code: "42601" });

    expect(isDatabaseAvailabilityError(error)).toBe(false);
    await expect(
      readPublicCmsWithBuildFallback(
        async () => {
          throw error;
        },
        () => [],
        buildEnvironment,
      ),
    ).rejects.toBe(error);
  });
});
