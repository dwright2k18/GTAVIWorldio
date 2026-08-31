import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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

  it("keeps the request-optimization migration limited to inert cache storage", () => {
    const sql = readFileSync("drizzle/0008_phase_4_4_request_optimization.sql", "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS http_cache jsonb NOT NULL DEFAULT/);
    expect(sql).not.toMatch(/is_active|recurring_monitoring_enabled|publish|schedule|indexable/i);
  });
});
