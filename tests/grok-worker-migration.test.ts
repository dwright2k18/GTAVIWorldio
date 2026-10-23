import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/0010_grok_worker_gateway.sql", "utf8");
const repository = readFileSync("src/lib/grok-worker/repository.ts", "utf8");
const http = readFileSync("src/lib/grok-worker/http.ts", "utf8");

const tables = [
  "grok_automation_controls",
  "grok_workers",
  "grok_worker_credentials",
  "grok_work_items",
  "grok_work_leases",
  "grok_submissions",
  "grok_validation_runs",
  "grok_publication_daily_counters",
  "grok_publication_evaluations",
  "grok_idempotency_records",
  "grok_rate_limit_buckets",
  "grok_audit_events",
  "grok_alerts",
] as const;

describe("Grok worker additive migration", () => {
  it("adds only isolated Grok tables and does not rewrite newsroom content", () => {
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.(?:stories|discovery_candidates|candidate_evidence|monitored_sources)\b/i);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.(?:stories|discovery_candidates|candidate_evidence)\b/i);
  });

  it("enables RLS and denies every browser-facing database role", () => {
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).toMatch(/REVOKE ALL ON public\.grok_automation_controls[\s\S]+FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]+ON public\.grok_/i);
    expect(sql).not.toMatch(/GRANT[\s\S]+TO (?:anon|authenticated)/i);
  });

  it("defaults every activation and publication control to fail closed", () => {
    expect(sql).toMatch(/api_enabled boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/queue_enabled boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/auto_publish_enabled boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/emergency_stop boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/daily_publication_cap integer NOT NULL DEFAULT 0/);
    expect(sql).not.toMatch(/INSERT INTO public\.grok_workers/i);
    expect(sql).not.toMatch(/INSERT INTO public\.grok_worker_credentials/i);
  });

  it("protects leases, immutable evidence, and direct API access", () => {
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("grok_work_leases_active_item_uidx");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION private\.grok_lease_work[\s\S]+FROM PUBLIC, anon, authenticated/);
    expect(sql).toContain("grok_submissions_immutable");
    expect(sql).toContain("grok_validation_runs_immutable");
    expect(sql).toContain("grok_audit_events_immutable");
  });

  it("claims idempotency before side effects and rechecks publication atomically", () => {
    expect(http.indexOf("claimIdempotency")).toBeLessThan(
      http.indexOf("operation(claim.id)"),
    );
    expect(repository).toContain("for update");
    expect(repository).toContain("DAILY_PUBLICATION_CAP_REACHED");
    expect(repository).toContain("AUTO_PUBLICATION_SOURCE_GAP");
    expect(repository).toContain("AUTO_PUBLICATION_VALIDATION_CHANGED");
    expect(repository).toContain("EVIDENCE_SNAPSHOT_CHANGED");
  });
});
