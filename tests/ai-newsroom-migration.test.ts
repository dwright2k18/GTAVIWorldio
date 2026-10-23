import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/0009_phase_5_ai_newsroom.sql", "utf8");

describe("Phase 5A additive migration safety", () => {
  it("creates private AI records with RLS and no authenticated direct writes", () => {
    const tables = ["ai_provider_settings", "ai_generations", "ai_research_packets", "ai_claims", "ai_quote_records", "ai_article_drafts", "ai_seo_packages", "ai_content_packages", "ai_cost_ledger", "ai_audit_logs"];
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).toMatch(/REVOKE ALL[\s\S]+FROM anon/);
    expect(sql).toMatch(/REVOKE ALL[\s\S]+FROM authenticated/);
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)[\s\S]+TO authenticated/i);
  });

  it("defaults provider, budgets, and emergency stop to fail closed", () => {
    expect(sql).toMatch(/is_enabled boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/emergency_stop boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/structured_output_required boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/web_access_enabled boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/daily_call_limit integer NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/per_candidate_cost_limit_micros integer NOT NULL DEFAULT 0/);
    expect(sql).toMatch(/max_regenerations integer NOT NULL DEFAULT 0/);
  });

  it("allows human private approval but no scheduling or publishing state", () => {
    const draftEnum = sql.match(/CREATE TYPE public\.ai_draft_status AS ENUM \(([^)]+)\)/)?.[1] ?? "";
    expect(draftEnum).toContain("NEEDS_REVIEW");
    expect(draftEnum).toContain("APPROVED");
    expect(draftEnum).not.toMatch(/SCHEDULED|PUBLISHED/);
    expect(sql).toMatch(/QUICK_HIT' AND target_duration_seconds = 13/);
  });

  it("protects claim evidence, exact quotes, and immutable ledgers", () => {
    expect(sql).toContain("validate_ai_claim_evidence");
    expect(sql).toContain("validate_ai_quote_provenance");
    expect(sql).toContain("ai_cost_ledger_immutable");
    expect(sql).toContain("ai_audit_logs_immutable");
    expect(sql).toContain("reserve_ai_generation");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toMatch(/greatest\(input_tokens, reserved_input_tokens\)/);
    expect(sql).toContain("candidate_regenerations + (CASE WHEN same_kind_exists THEN 1 ELSE 0 END)");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.reserve_ai_generation[\s\S]*FROM anon, authenticated/);
    expect(sql).toContain("validate_ai_candidate_consistency");
    expect(sql).toMatch(/profile\.role = 'AUTHOR' AND candidate\.assigned_to = profile\.id/);
    expect(sql).not.toContain("SELECT public.can_read_discovery_candidate(target_candidate_id)");
  });

  it("preserves human SEO attribution and marks superseded packages stale", () => {
    expect(sql).toMatch(/override_by uuid REFERENCES public\.editor_profiles\(id\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/is_stale boolean NOT NULL DEFAULT false/);
    expect(sql).toContain("ai_seo_packages_stale_reason_check");
    expect(sql).toContain("ai_content_packages_stale_reason_check");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ai_content_packages_current_draft_kind_uidx[\s\S]*WHERE is_stale = false/);
    expect(sql).not.toContain("ai_content_packages_draft_kind_unique");
  });

  it("does not touch Production discovery, publishing, analytics, or indexing controls", () => {
    expect(sql).not.toMatch(/UPDATE\s+public\.(discovery_settings|monitored_sources|stories)/i);
    expect(sql).not.toMatch(/NEXT_PUBLIC_SITE_INDEXABLE|Search Console|analytics/i);
  });

  it("allows only the reviewed pending or fully applied Phase 5A migration states", () => {
    const check = readFileSync("scripts/check-database.ts", "utf8");
    expect(check).toContain('pendingMigrations[0] === "0009_phase_5_ai_newsroom"');
    expect(check).toContain("pendingMigrations.length === 0");
    expect(check).toContain("migrationLedger.length <= expectedMigrations.length");
    expect(check).not.toMatch(/migrationLedger\.length !== 9/);
    expect(check).not.toMatch(/discovery_candidates !== 1/);
    expect(check).not.toMatch(/discovery_score_runs !== 1/);
    expect(check).toContain("counts.non_ai_rls_tables !== 32");
    expect(check).toContain("counts.rls_tables !== counts.non_ai_rls_tables + counts.ai_rls_tables");
  });

  it("serializes Phase 5A mutations and revalidates provider snapshots before storage", () => {
    const actions = readFileSync("src/app/admin/(protected)/ai/actions.ts", "utf8");
    expect(actions.match(/for update/g)?.length).toBeGreaterThanOrEqual(8);
    expect(actions).toContain("evidenceHash(currentClaims) !== input.approvedClaimsHash");
    expect(actions).toContain("evidenceHash(currentDraft.draft) !== input.latestDraftHash");
    expect(actions).toContain("The research packet or draft changed while the package was being generated.");
  });
});
