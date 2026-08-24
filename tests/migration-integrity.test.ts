import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  migrationHashesMatch,
  normalizedMigrationHash,
  normalizeMigrationSql,
} from "../scripts/lib/migration-integrity";

describe("migration integrity normalization", () => {
  it("produces the same digest for LF, CRLF, and legacy CR text", () => {
    const lf = "select 1;\nselect 2;\n";
    expect(normalizedMigrationHash(lf.replace(/\n/g, "\r\n"))).toBe(
      normalizedMigrationHash(lf),
    );
    expect(normalizedMigrationHash(lf.replace(/\n/g, "\r"))).toBe(
      normalizedMigrationHash(lf),
    );
  });

  it("matches Drizzle's Linux/LF migration ledger digest", () => {
    const windowsSql = "select 1;\r\n";
    const drizzleLinuxHash = createHash("sha256")
      .update("select 1;\n")
      .digest("hex");
    expect(normalizeMigrationSql(windowsSql)).toBe("select 1;\n");
    expect(normalizedMigrationHash(windowsSql)).toBe(drizzleLinuxHash);
  });

  it("requires every ordered migration hash to match", () => {
    expect(migrationHashesMatch(
      [{ hash: "one" }, { hash: "two" }],
      [{ hash: "one" }, { hash: "two" }],
    )).toBe(true);
    expect(migrationHashesMatch(
      [{ hash: "one" }, { hash: "two" }],
      [{ hash: "two" }, { hash: "one" }],
    )).toBe(false);
  });
});
