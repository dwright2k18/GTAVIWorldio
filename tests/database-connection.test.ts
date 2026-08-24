import { describe, expect, it } from "vitest";

import {
  configuredDatabaseUrl,
  databaseUrl,
  PREVIEW_DISABLED_DATABASE_URL,
} from "@/db/connection-url";

describe("database connection selection", () => {
  it("prefers the pooled URL when both connection types are configured", () => {
    expect(
      configuredDatabaseUrl({
        POSTGRES_URL: "postgres://pooled.example/db",
        POSTGRES_URL_NON_POOLING: "postgres://direct.example/db",
      }),
    ).toBe("postgres://pooled.example/db");
  });

  it("retains the non-pooling URL as a fallback", () => {
    expect(
      configuredDatabaseUrl({
        POSTGRES_URL: undefined,
        POSTGRES_URL_NON_POOLING: "postgres://direct.example/db",
      }),
    ).toBe("postgres://direct.example/db");
  });

  it("fails closed when neither URL is configured", () => {
    expect(configuredDatabaseUrl({})).toBeNull();
    expect(databaseUrl({})).toBe(PREVIEW_DISABLED_DATABASE_URL);
  });

  it("ignores blank configured values", () => {
    expect(
      configuredDatabaseUrl({
        POSTGRES_URL: "   ",
        POSTGRES_URL_NON_POOLING: "postgres://direct.example/db",
      }),
    ).toBe("postgres://direct.example/db");
  });
});
