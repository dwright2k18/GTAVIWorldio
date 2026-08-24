ALTER TYPE public.discovery_alert_type ADD VALUE IF NOT EXISTS 'OFFICIAL_SOURCE_GAP';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE public.discovery_score_metric AS ENUM (
    'SOURCE_AUTHORITY',
    'CONFIDENCE',
    'NEWSWORTHINESS',
    'SEO_OPPORTUNITY',
    'TREND',
    'QUICK_HIT',
    'PRIMARY_VIDEO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE public.monitored_sources
  ADD COLUMN IF NOT EXISTS coverage_group text,
  ADD COLUMN IF NOT EXISTS signal_label text;
ALTER TABLE public.source_fetch_runs
  ADD COLUMN IF NOT EXISTS duration_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_responses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_extractions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_urls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS known_urls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_attached integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE public.source_fetch_runs
  ADD CONSTRAINT source_fetch_runs_observability_nonnegative_check CHECK (
    duration_ms >= 0
    AND successful_responses >= 0
    AND successful_extractions >= 0
    AND new_urls >= 0
    AND known_urls >= 0
    AND evidence_attached >= 0
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.discovery_score_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  scoring_version text NOT NULL,
  input_hash text NOT NULL,
  source_authority_score integer NOT NULL,
  confidence_score integer NOT NULL,
  newsworthiness_score integer NOT NULL,
  seo_opportunity_score integer NOT NULL,
  trend_score integer NOT NULL,
  quick_hit_score integer NOT NULL,
  primary_video_score integer NOT NULL,
  component_breakdown jsonb NOT NULL,
  input_snapshot jsonb NOT NULL,
  scored_at timestamp with time zone NOT NULL DEFAULT now(),
  is_test boolean NOT NULL DEFAULT false,
  CONSTRAINT discovery_score_runs_scores_check CHECK (
    source_authority_score BETWEEN 0 AND 100
    AND confidence_score BETWEEN 0 AND 100
    AND newsworthiness_score BETWEEN 0 AND 100
    AND seo_opportunity_score BETWEEN 0 AND 100
    AND trend_score BETWEEN 0 AND 100
    AND quick_hit_score BETWEEN 0 AND 100
    AND primary_video_score BETWEEN 0 AND 100
  ),
  CONSTRAINT discovery_score_runs_version_check CHECK (scoring_version ~ '^scoring_v[0-9]+$'),
  CONSTRAINT discovery_score_runs_hash_check CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT discovery_score_runs_candidate_version_hash_unique UNIQUE (candidate_id, scoring_version, input_hash)
);
CREATE INDEX IF NOT EXISTS discovery_score_runs_candidate_date_idx
  ON public.discovery_score_runs(candidate_id, scored_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.discovery_score_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_run_id uuid NOT NULL REFERENCES public.discovery_score_runs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  metric public.discovery_score_metric NOT NULL,
  original_score integer NOT NULL,
  override_score integer NOT NULL,
  editor_id uuid NOT NULL REFERENCES public.editor_profiles(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT discovery_score_overrides_scores_check CHECK (
    original_score BETWEEN 0 AND 100 AND override_score BETWEEN 0 AND 100
  ),
  CONSTRAINT discovery_score_overrides_reason_check CHECK (char_length(btrim(reason)) BETWEEN 12 AND 2000)
);
CREATE INDEX IF NOT EXISTS discovery_score_overrides_candidate_date_idx
  ON public.discovery_score_overrides(candidate_id, created_at);
CREATE INDEX IF NOT EXISTS discovery_score_overrides_run_idx
  ON public.discovery_score_overrides(score_run_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.validate_discovery_score_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  run_record public.discovery_score_runs%ROWTYPE;
  expected_score integer;
BEGIN
  SELECT * INTO run_record FROM public.discovery_score_runs WHERE id = NEW.score_run_id;
  IF run_record.id IS NULL OR run_record.candidate_id <> NEW.candidate_id THEN
    RAISE EXCEPTION 'Score override must reference the matching candidate score run' USING ERRCODE = '42501';
  END IF;

  expected_score := CASE NEW.metric
    WHEN 'SOURCE_AUTHORITY' THEN run_record.source_authority_score
    WHEN 'CONFIDENCE' THEN run_record.confidence_score
    WHEN 'NEWSWORTHINESS' THEN run_record.newsworthiness_score
    WHEN 'SEO_OPPORTUNITY' THEN run_record.seo_opportunity_score
    WHEN 'TREND' THEN run_record.trend_score
    WHEN 'QUICK_HIT' THEN run_record.quick_hit_score
    WHEN 'PRIMARY_VIDEO' THEN run_record.primary_video_score
  END;
  IF NEW.original_score <> expected_score THEN
    RAISE EXCEPTION 'Original score must match the immutable automated score run' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NOT NULL AND (
    NOT public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    OR NEW.editor_id <> public.current_editor_profile_id()
  ) THEN
    RAISE EXCEPTION 'Only authorized editors can create attributed score overrides' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_discovery_score_override() FROM PUBLIC;
CREATE TRIGGER discovery_score_overrides_validate
  BEFORE INSERT ON public.discovery_score_overrides
  FOR EACH ROW EXECUTE FUNCTION public.validate_discovery_score_override();
--> statement-breakpoint
ALTER TABLE public.discovery_score_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_score_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role scoped score run reads" ON public.discovery_score_runs
  FOR SELECT TO authenticated USING (public.can_read_discovery_candidate(candidate_id));
CREATE POLICY "role scoped score override reads" ON public.discovery_score_overrides
  FOR SELECT TO authenticated USING (public.can_read_discovery_candidate(candidate_id));
CREATE POLICY "editors append attributed score overrides" ON public.discovery_score_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND editor_id = public.current_editor_profile_id()
    AND public.can_read_discovery_candidate(candidate_id)
  );
REVOKE ALL ON public.discovery_score_runs, public.discovery_score_overrides FROM anon;
REVOKE ALL ON public.discovery_score_runs, public.discovery_score_overrides FROM authenticated;
GRANT SELECT ON public.discovery_score_runs, public.discovery_score_overrides TO authenticated;
GRANT INSERT ON public.discovery_score_overrides TO authenticated;
--> statement-breakpoint
UPDATE public.monitored_sources SET
  coverage_group = 'ROCKSTAR_OFFICIAL',
  signal_label = 'Newswire HTML',
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000001';
UPDATE public.monitored_sources SET
  coverage_group = 'ROCKSTAR_OFFICIAL',
  signal_label = 'Known pages',
  connector_config = connector_config || '{"discoverOfficialArticleLinks":true,"maxDetailItems":3}'::jsonb,
  is_active = false,
  rate_limit_per_hour = 6,
  min_check_interval_minutes = 120,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000002';
UPDATE public.monitored_sources SET
  coverage_group = 'ROCKSTAR_OFFICIAL',
  signal_label = 'Known pages',
  url = 'https://www.rockstargames.com/VI/media/videos',
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000003';
UPDATE public.monitored_sources SET
  coverage_group = 'TAKE_TWO_OFFICIAL',
  signal_label = 'Take-Two',
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000004';
UPDATE public.monitored_sources SET
  coverage_group = 'ROCKSTAR_OFFICIAL',
  signal_label = 'Official YouTube',
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000009';
--> statement-breakpoint
UPDATE public.discovery_settings SET
  recurring_monitoring_enabled = false,
  automatic_drafting_enabled = false,
  deep_research_enabled = false,
  max_ai_triage_calls_per_day = 0,
  max_ai_research_calls_per_day = 0,
  max_estimated_monthly_cost_cents = 0,
  updated_at = now();
