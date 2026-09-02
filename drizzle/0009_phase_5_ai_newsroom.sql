DO $$ BEGIN
  CREATE TYPE public.ai_generation_kind AS ENUM ('RESEARCH_PACKET', 'ARTICLE_DRAFT', 'SEO_PACKAGE', 'PRIMARY_VIDEO', 'QUICK_HIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.ai_generation_status AS ENUM ('REQUESTED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BUDGET_EXHAUSTED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.ai_claim_review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.ai_draft_status AS ENUM ('DRAFTING', 'FACT_CHECK', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.ai_attribution_mode AS ENUM ('DIRECT_QUOTE', 'PARAPHRASE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.ai_content_package_kind AS ENUM ('PRIMARY_VIDEO', 'QUICK_HIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text,
  research_model text,
  drafting_model text,
  input_price_micros_per_million integer NOT NULL DEFAULT 0,
  output_price_micros_per_million integer NOT NULL DEFAULT 0,
  structured_output_required boolean NOT NULL DEFAULT true,
  web_access_enabled boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT false,
  emergency_stop boolean NOT NULL DEFAULT true,
  daily_call_limit integer NOT NULL DEFAULT 0,
  daily_input_token_limit integer NOT NULL DEFAULT 0,
  daily_output_token_limit integer NOT NULL DEFAULT 0,
  daily_cost_limit_micros integer NOT NULL DEFAULT 0,
  per_candidate_call_limit integer NOT NULL DEFAULT 0,
  per_candidate_cost_limit_micros integer NOT NULL DEFAULT 0,
  max_regenerations integer NOT NULL DEFAULT 0,
  request_timeout_ms integer NOT NULL DEFAULT 60000,
  retry_limit integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_provider_settings_limits_check CHECK (
    input_price_micros_per_million >= 0 AND output_price_micros_per_million >= 0
    AND daily_call_limit >= 0 AND daily_input_token_limit >= 0
    AND daily_output_token_limit >= 0 AND daily_cost_limit_micros >= 0
    AND per_candidate_call_limit >= 0 AND per_candidate_cost_limit_micros >= 0
    AND max_regenerations >= 0 AND retry_limit BETWEEN 0 AND 2
    AND request_timeout_ms BETWEEN 1000 AND 120000
  ),
  CONSTRAINT ai_provider_settings_enabled_check CHECK (
    NOT is_enabled OR (
      emergency_stop = false
      AND provider_code IS NOT NULL
      AND research_model IS NOT NULL
      AND drafting_model IS NOT NULL
      AND structured_output_required = true
      AND web_access_enabled = false
      AND input_price_micros_per_million > 0
      AND output_price_micros_per_million > 0
      AND daily_call_limit > 0
      AND daily_input_token_limit > 0
      AND daily_output_token_limit > 0
      AND daily_cost_limit_micros > 0
      AND per_candidate_call_limit > 0
      AND per_candidate_cost_limit_micros > 0
    )
  )
);
--> statement-breakpoint
INSERT INTO public.ai_provider_settings (
  id, is_enabled, emergency_stop, daily_call_limit, daily_input_token_limit,
  daily_output_token_limit, daily_cost_limit_micros, per_candidate_call_limit,
  per_candidate_cost_limit_micros, max_regenerations, retry_limit
) VALUES (
  '51000000-0000-4000-8000-000000000001', false, true, 0, 0, 0, 0, 0, 0, 0, 0
) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  kind public.ai_generation_kind NOT NULL,
  status public.ai_generation_status NOT NULL DEFAULT 'REQUESTED',
  provider_code text,
  model_id text,
  prompt_version text NOT NULL,
  input_evidence_hash text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  requested_by uuid NOT NULL REFERENCES public.editor_profiles(id) ON DELETE RESTRICT,
  requested_reason text NOT NULL,
  cancellation_requested boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  output jsonb,
  schema_validation_passed boolean NOT NULL DEFAULT false,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_micros integer NOT NULL DEFAULT 0,
  actual_cost_micros integer,
  reserved_input_tokens integer NOT NULL DEFAULT 0,
  reserved_output_tokens integer NOT NULL DEFAULT 0,
  reserved_cost_micros integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_generations_hash_check CHECK (input_evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ai_generations_usage_check CHECK (
    input_tokens >= 0 AND output_tokens >= 0 AND estimated_cost_micros >= 0
    AND (actual_cost_micros IS NULL OR actual_cost_micros >= 0)
    AND reserved_input_tokens >= 0 AND reserved_output_tokens >= 0 AND reserved_cost_micros >= 0
  ),
  CONSTRAINT ai_generations_reason_check CHECK (char_length(btrim(requested_reason)) BETWEEN 8 AND 2000)
);
CREATE INDEX IF NOT EXISTS ai_generations_candidate_date_idx ON public.ai_generations(candidate_id, created_at DESC);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(
  p_id uuid,
  p_candidate_id uuid,
  p_kind public.ai_generation_kind,
  p_provider_code text,
  p_model_id text,
  p_prompt_version text,
  p_input_evidence_hash text,
  p_idempotency_key text,
  p_requested_by uuid,
  p_requested_reason text,
  p_reserved_input_tokens integer,
  p_reserved_output_tokens integer,
  p_reserved_cost_micros integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  settings public.ai_provider_settings%ROWTYPE;
  daily_calls integer;
  daily_input_tokens bigint;
  daily_output_tokens bigint;
  daily_cost_micros bigint;
  candidate_calls integer;
  candidate_cost_micros bigint;
  candidate_regenerations integer;
  same_kind_exists boolean;
BEGIN
  IF p_reserved_input_tokens <= 0 OR p_reserved_output_tokens <= 0 OR p_reserved_cost_micros <= 0 THEN
    RAISE EXCEPTION 'AI generation reservations must be positive' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('gtaviworldio-ai-generation-budget-' || (now() AT TIME ZONE 'UTC')::date::text));
  SELECT * INTO STRICT settings FROM public.ai_provider_settings LIMIT 1 FOR UPDATE;
  IF NOT settings.is_enabled OR settings.emergency_stop
    OR NOT settings.structured_output_required OR settings.web_access_enabled
  THEN
    RAISE EXCEPTION 'AI generation is disabled by provider safety controls' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ai_generations WHERE idempotency_key = p_idempotency_key) THEN
    RAISE EXCEPTION 'AI generation idempotency key already exists' USING ERRCODE = '23505';
  END IF;

  SELECT count(*)::integer,
    coalesce(sum(greatest(input_tokens, reserved_input_tokens)), 0),
    coalesce(sum(greatest(output_tokens, reserved_output_tokens)), 0),
    coalesce(sum(greatest(estimated_cost_micros, reserved_cost_micros)), 0)
  INTO daily_calls, daily_input_tokens, daily_output_tokens, daily_cost_micros
  FROM public.ai_generations
  WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT count(*)::integer,
    coalesce(sum(greatest(estimated_cost_micros, reserved_cost_micros)), 0),
    greatest(count(*) - count(DISTINCT kind), 0)::integer,
    coalesce(bool_or(kind = p_kind), false)
  INTO candidate_calls, candidate_cost_micros, candidate_regenerations, same_kind_exists
  FROM public.ai_generations WHERE candidate_id = p_candidate_id;

  IF settings.daily_call_limit <= daily_calls
    OR settings.daily_input_token_limit < daily_input_tokens + p_reserved_input_tokens
    OR settings.daily_output_token_limit < daily_output_tokens + p_reserved_output_tokens
    OR settings.daily_cost_limit_micros < daily_cost_micros + p_reserved_cost_micros
    OR settings.per_candidate_call_limit <= candidate_calls
    OR settings.per_candidate_cost_limit_micros < candidate_cost_micros + p_reserved_cost_micros
    OR settings.max_regenerations < candidate_regenerations + CASE WHEN same_kind_exists THEN 1 ELSE 0 END
  THEN
    RAISE EXCEPTION 'AI generation budget is exhausted' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ai_generations (
    id, candidate_id, kind, status, provider_code, model_id, prompt_version,
    input_evidence_hash, idempotency_key, requested_by, requested_reason,
    estimated_cost_micros, reserved_input_tokens, reserved_output_tokens, reserved_cost_micros, started_at
  ) VALUES (
    p_id, p_candidate_id, p_kind, 'RUNNING', p_provider_code, p_model_id, p_prompt_version,
    p_input_evidence_hash, p_idempotency_key, p_requested_by, p_requested_reason,
    p_reserved_cost_micros, p_reserved_input_tokens, p_reserved_output_tokens, p_reserved_cost_micros, now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_generation(uuid, uuid, public.ai_generation_kind, text, text, text, text, text, uuid, text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_ai_generation(uuid, uuid, public.ai_generation_kind, text, text, text, text, text, uuid, text, integer, integer, integer) FROM anon, authenticated;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_research_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  generation_id uuid NOT NULL REFERENCES public.ai_generations(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  packet jsonb NOT NULL,
  approved_claims_hash text,
  created_by uuid NOT NULL REFERENCES public.editor_profiles(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_research_packets_version_check CHECK (version > 0),
  CONSTRAINT ai_research_packets_candidate_version_unique UNIQUE (candidate_id, version)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.ai_research_packets(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  claim_key text NOT NULL,
  claim_text text NOT NULL,
  evidence_record_ids uuid[] NOT NULL,
  source_url text NOT NULL,
  source_type public.source_type NOT NULL,
  attribution_mode public.ai_attribution_mode NOT NULL,
  confidence integer NOT NULL,
  verification_status public.verification_status NOT NULL,
  contradiction_status text NOT NULL DEFAULT 'NONE',
  review_status public.ai_claim_review_status NOT NULL DEFAULT 'PENDING',
  included_in_draft boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL,
  review_reason text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_claims_confidence_check CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT ai_claims_evidence_check CHECK (cardinality(evidence_record_ids) > 0),
  CONSTRAINT ai_claims_human_review_check CHECK (
    (review_status = 'PENDING' AND reviewed_by IS NULL AND review_reason IS NULL AND reviewed_at IS NULL AND included_in_draft = false)
    OR (review_status <> 'PENDING' AND reviewed_by IS NOT NULL AND char_length(btrim(review_reason)) >= 8 AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT ai_claims_inclusion_check CHECK (included_in_draft = false OR review_status = 'APPROVED'),
  CONSTRAINT ai_claims_packet_key_unique UNIQUE (packet_id, claim_key)
);
CREATE INDEX IF NOT EXISTS ai_claims_candidate_review_idx ON public.ai_claims(candidate_id, review_status);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_quote_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.ai_research_packets(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.ai_claims(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.candidate_evidence(id) ON DELETE RESTRICT,
  exact_text text NOT NULL,
  speaker_organization text NOT NULL,
  original_source text NOT NULL,
  source_url text NOT NULL,
  source_date timestamp with time zone,
  locator text,
  context text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_quote_records_exact_text_check CHECK (char_length(btrim(exact_text)) BETWEEN 1 AND 600)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_article_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  packet_id uuid NOT NULL REFERENCES public.ai_research_packets(id) ON DELETE RESTRICT,
  generation_id uuid NOT NULL REFERENCES public.ai_generations(id) ON DELETE RESTRICT,
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  status public.ai_draft_status NOT NULL DEFAULT 'DRAFTING',
  draft jsonb NOT NULL,
  grounding_passed boolean NOT NULL DEFAULT false,
  grounding_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES public.editor_profiles(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.editor_profiles(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_article_drafts_version_check CHECK (version > 0),
  CONSTRAINT ai_article_drafts_candidate_version_unique UNIQUE (candidate_id, version),
  CONSTRAINT ai_article_drafts_review_gate_check CHECK (status NOT IN ('NEEDS_REVIEW', 'APPROVED') OR grounding_passed = true)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_seo_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.ai_article_drafts(id) ON DELETE CASCADE,
  generation_id uuid NOT NULL REFERENCES public.ai_generations(id) ON DELETE RESTRICT,
  original_suggestion jsonb NOT NULL,
  editor_override jsonb,
  override_by uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL,
  override_reason text,
  override_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_seo_packages_override_attribution_check CHECK (
    (editor_override IS NULL AND override_by IS NULL AND override_reason IS NULL AND override_at IS NULL)
    OR (editor_override IS NOT NULL AND override_by IS NOT NULL AND char_length(btrim(override_reason)) >= 8 AND override_at IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_content_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.ai_article_drafts(id) ON DELETE CASCADE,
  generation_id uuid NOT NULL REFERENCES public.ai_generations(id) ON DELETE RESTRICT,
  kind public.ai_content_package_kind NOT NULL,
  target_duration_seconds integer NOT NULL,
  content jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_content_packages_duration_check CHECK (
    (kind = 'PRIMARY_VIDEO' AND target_duration_seconds BETWEEN 61 AND 90)
    OR (kind = 'QUICK_HIT' AND target_duration_seconds = 13)
  ),
  CONSTRAINT ai_content_packages_draft_kind_unique UNIQUE (draft_id, kind)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.ai_generations(id) ON DELETE RESTRICT UNIQUE,
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE RESTRICT,
  usage_date text NOT NULL,
  provider_code text NOT NULL,
  model_id text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  estimated_cost_micros integer NOT NULL,
  actual_cost_micros integer,
  cost_micros integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_cost_ledger_usage_check CHECK (
    input_tokens >= 0 AND output_tokens >= 0 AND estimated_cost_micros >= 0
    AND (actual_cost_micros IS NULL OR actual_cost_micros >= 0) AND cost_micros >= 0
  ),
  CONSTRAINT ai_cost_ledger_date_check CHECK (usage_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);
CREATE INDEX IF NOT EXISTS ai_cost_ledger_date_idx ON public.ai_cost_ledger(usage_date);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid REFERENCES public.ai_generations(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  draft_id uuid REFERENCES public.ai_article_drafts(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_audit_logs_reason_check CHECK (char_length(btrim(reason)) BETWEEN 4 AND 2000)
);
CREATE INDEX IF NOT EXISTS ai_audit_candidate_date_idx ON public.ai_audit_logs(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_audit_action_idx ON public.ai_audit_logs(action);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.validate_ai_claim_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE evidence_id uuid;
BEGIN
  SELECT candidate_id INTO STRICT evidence_id FROM public.ai_research_packets WHERE id = NEW.packet_id;
  IF evidence_id <> NEW.candidate_id THEN
    RAISE EXCEPTION 'Claim candidate must match research packet candidate' USING ERRCODE = '42501';
  END IF;
  FOREACH evidence_id IN ARRAY NEW.evidence_record_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.candidate_evidence evidence
      WHERE evidence.id = evidence_id
        AND evidence.candidate_id = NEW.candidate_id
        AND evidence.source_url = NEW.source_url
    ) THEN
      RAISE EXCEPTION 'Every claim must map to candidate evidence at the stated source URL' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_ai_claim_evidence() FROM PUBLIC;
CREATE TRIGGER ai_claims_validate_evidence BEFORE INSERT OR UPDATE ON public.ai_claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_claim_evidence();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.validate_ai_quote_provenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE claim_record public.ai_claims%ROWTYPE;
DECLARE evidence_record public.candidate_evidence%ROWTYPE;
BEGIN
  SELECT * INTO claim_record FROM public.ai_claims WHERE id = NEW.claim_id;
  SELECT * INTO evidence_record FROM public.candidate_evidence WHERE id = NEW.evidence_id;
  IF claim_record.id IS NULL OR evidence_record.id IS NULL
    OR claim_record.packet_id <> NEW.packet_id
    OR claim_record.candidate_id <> NEW.candidate_id
    OR evidence_record.candidate_id <> NEW.candidate_id
    OR claim_record.attribution_mode <> 'DIRECT_QUOTE'
    OR NOT (NEW.evidence_id = ANY(claim_record.evidence_record_ids))
    OR NEW.source_url <> evidence_record.source_url
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(evidence_record.exact_quotes) quote
      WHERE quote->>'text' = NEW.exact_text
    )
  THEN
    RAISE EXCEPTION 'Exact quote must match its stored candidate evidence and direct-quote claim' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_ai_quote_provenance() FROM PUBLIC;
CREATE TRIGGER ai_quote_records_validate_provenance BEFORE INSERT OR UPDATE ON public.ai_quote_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_quote_provenance();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.prevent_ai_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'AI cost and audit records are immutable' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_ai_ledger_mutation() FROM PUBLIC;
CREATE TRIGGER ai_cost_ledger_immutable BEFORE UPDATE OR DELETE ON public.ai_cost_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ai_ledger_mutation();
CREATE TRIGGER ai_audit_logs_immutable BEFORE UPDATE OR DELETE ON public.ai_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ai_ledger_mutation();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.can_read_ai_candidate(target_candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT public.can_read_discovery_candidate(target_candidate_id);
$$;
REVOKE ALL ON FUNCTION public.can_read_ai_candidate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_ai_candidate(uuid) TO authenticated;
--> statement-breakpoint

ALTER TABLE public.ai_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_research_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quote_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_article_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_seo_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_content_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read ai provider settings" ON public.ai_provider_settings
  FOR SELECT TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));
CREATE POLICY "role scoped ai generation reads" ON public.ai_generations
  FOR SELECT TO authenticated USING (public.can_read_ai_candidate(candidate_id));
CREATE POLICY "role scoped research packet reads" ON public.ai_research_packets
  FOR SELECT TO authenticated USING (public.can_read_ai_candidate(candidate_id));
CREATE POLICY "role scoped ai claim reads" ON public.ai_claims
  FOR SELECT TO authenticated USING (public.can_read_ai_candidate(candidate_id));
CREATE POLICY "role scoped ai quote reads" ON public.ai_quote_records
  FOR SELECT TO authenticated USING (public.can_read_ai_candidate(candidate_id));
CREATE POLICY "role scoped ai draft reads" ON public.ai_article_drafts
  FOR SELECT TO authenticated USING (public.can_read_ai_candidate(candidate_id));
CREATE POLICY "role scoped seo package reads" ON public.ai_seo_packages
  FOR SELECT TO authenticated USING (public.can_read_ai_candidate(candidate_id));
CREATE POLICY "role scoped content package reads" ON public.ai_content_packages
  FOR SELECT TO authenticated USING (public.can_read_ai_candidate(candidate_id));
CREATE POLICY "editors read ai cost ledger" ON public.ai_cost_ledger
  FOR SELECT TO authenticated USING (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND public.can_read_ai_candidate(candidate_id)
  );
CREATE POLICY "role scoped ai audit reads" ON public.ai_audit_logs
  FOR SELECT TO authenticated USING (
    (candidate_id IS NOT NULL AND public.can_read_ai_candidate(candidate_id))
    OR (candidate_id IS NULL AND public.has_newsroom_role('OWNER', 'ADMIN'))
  );

REVOKE ALL ON public.ai_provider_settings, public.ai_generations, public.ai_research_packets,
  public.ai_claims, public.ai_quote_records, public.ai_article_drafts, public.ai_seo_packages,
  public.ai_content_packages, public.ai_cost_ledger, public.ai_audit_logs FROM anon;
REVOKE ALL ON public.ai_provider_settings, public.ai_generations, public.ai_research_packets,
  public.ai_claims, public.ai_quote_records, public.ai_article_drafts, public.ai_seo_packages,
  public.ai_content_packages, public.ai_cost_ledger, public.ai_audit_logs FROM authenticated;
GRANT SELECT ON public.ai_provider_settings, public.ai_generations, public.ai_research_packets,
  public.ai_claims, public.ai_quote_records, public.ai_article_drafts, public.ai_seo_packages,
  public.ai_content_packages, public.ai_cost_ledger, public.ai_audit_logs TO authenticated;

-- Phase 5A is inert until a separate provider, budget, migration, and deployment approval.
-- No secrets are stored in these tables and no discovery, drafting, or publishing flag is changed.
