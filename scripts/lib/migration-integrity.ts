import { createHash } from "node:crypto";

export function normalizeMigrationSql(sql: string) {
  return sql.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizedMigrationHash(sql: string) {
  return createHash("sha256").update(normalizeMigrationSql(sql)).digest("hex");
}

export function migrationHashesMatch(
  expected: Array<{ hash: string }>,
  ledger: Array<{ hash: string }>,
) {
  return (
    expected.length === ledger.length &&
    expected.every((migration, index) => migration.hash === ledger[index]?.hash)
  );
}
