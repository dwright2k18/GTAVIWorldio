ALTER TABLE public.discovery_settings
  ADD COLUMN max_candidates_per_day integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE public.discovery_settings
  DROP CONSTRAINT discovery_settings_limits_check;
ALTER TABLE public.discovery_settings
  ADD CONSTRAINT discovery_settings_limits_check CHECK (
    max_requests_per_day BETWEEN 0 AND 10000
    AND max_candidates_per_run BETWEEN 0 AND 500
    AND max_candidates_per_day BETWEEN 0 AND 500
    AND max_ai_triage_calls_per_day BETWEEN 0 AND 1000
    AND max_ai_research_calls_per_day BETWEEN 0 AND 500
    AND max_estimated_monthly_cost_cents BETWEEN 0 AND 100000
    AND retention_days BETWEEN 7 AND 365
  );
--> statement-breakpoint
CREATE TABLE public.discovery_execution_locks (
  lock_name text PRIMARY KEY,
  lock_token uuid NOT NULL,
  acquired_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.discovery_execution_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discovery_execution_locks FROM anon, authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reserve_discovery_daily_usage(
  p_usage_date text,
  p_request_delta integer,
  p_candidate_delta integer,
  p_request_limit integer,
  p_candidate_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved boolean;
BEGIN
  IF p_usage_date IS NULL OR p_usage_date = ''
    OR p_request_delta < 0 OR p_candidate_delta < 0
    OR (p_request_delta = 0 AND p_candidate_delta = 0)
    OR p_request_limit < 0 OR p_candidate_limit < 0
    OR (p_request_delta > 0 AND p_request_delta > p_request_limit)
    OR (p_candidate_delta > 0 AND p_candidate_delta > p_candidate_limit)
  THEN
    RETURN false;
  END IF;

  INSERT INTO public.discovery_usage_daily (
    usage_date,
    request_count,
    candidates_created,
    response_bytes,
    ai_triage_calls,
    ai_research_calls,
    estimated_cost_micros,
    updated_at
  ) VALUES (
    p_usage_date,
    p_request_delta,
    p_candidate_delta,
    0,
    0,
    0,
    0,
    now()
  )
  ON CONFLICT (usage_date) DO UPDATE SET
    request_count = public.discovery_usage_daily.request_count + EXCLUDED.request_count,
    candidates_created = public.discovery_usage_daily.candidates_created + EXCLUDED.candidates_created,
    updated_at = now()
  WHERE
    (p_request_delta = 0 OR public.discovery_usage_daily.request_count + p_request_delta <= p_request_limit)
    AND (p_candidate_delta = 0 OR public.discovery_usage_daily.candidates_created + p_candidate_delta <= p_candidate_limit)
  RETURNING true INTO reserved;

  RETURN coalesce(reserved, false);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_discovery_daily_usage(text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.release_discovery_daily_usage(
  p_usage_date text,
  p_request_delta integer,
  p_candidate_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_request_delta < 0 OR p_candidate_delta < 0 THEN
    RAISE EXCEPTION 'Discovery usage release values must be non-negative';
  END IF;

  UPDATE public.discovery_usage_daily SET
    request_count = greatest(0, request_count - p_request_delta),
    candidates_created = greatest(0, candidates_created - p_candidate_delta),
    updated_at = now()
  WHERE usage_date = p_usage_date;
END;
$$;
REVOKE ALL ON FUNCTION public.release_discovery_daily_usage(text, integer, integer) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.acquire_discovery_execution_lock(
  p_lock_name text,
  p_lock_token uuid,
  p_ttl_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean;
BEGIN
  IF p_lock_name IS NULL OR p_lock_name = '' OR p_ttl_seconds < 30 OR p_ttl_seconds > 3600 THEN
    RETURN false;
  END IF;

  INSERT INTO public.discovery_execution_locks (
    lock_name,
    lock_token,
    acquired_at,
    expires_at,
    updated_at
  ) VALUES (
    p_lock_name,
    p_lock_token,
    now(),
    now() + make_interval(secs => p_ttl_seconds),
    now()
  )
  ON CONFLICT (lock_name) DO UPDATE SET
    lock_token = EXCLUDED.lock_token,
    acquired_at = EXCLUDED.acquired_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = EXCLUDED.updated_at
  WHERE public.discovery_execution_locks.expires_at <= now()
  RETURNING true INTO acquired;

  RETURN coalesce(acquired, false);
END;
$$;
REVOKE ALL ON FUNCTION public.acquire_discovery_execution_lock(text, uuid, integer) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.release_discovery_execution_lock(
  p_lock_name text,
  p_lock_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released boolean;
BEGIN
  DELETE FROM public.discovery_execution_locks
  WHERE lock_name = p_lock_name AND lock_token = p_lock_token
  RETURNING true INTO released;
  RETURN coalesce(released, false);
END;
$$;
REVOKE ALL ON FUNCTION public.release_discovery_execution_lock(text, uuid) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
UPDATE public.monitored_sources SET
  connector_config = connector_config || '{"maxDetailItems":3}'::jsonb,
  min_check_interval_minutes = 360,
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000001';
UPDATE public.monitored_sources SET
  connector_config = connector_config || '{"maxDetailItems":3}'::jsonb,
  min_check_interval_minutes = 240,
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000002';
UPDATE public.monitored_sources SET
  connector_config = connector_config || '{"maxDetailItems":3}'::jsonb,
  min_check_interval_minutes = 360,
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000003';
UPDATE public.monitored_sources SET
  connector_config = connector_config || '{"maxDetailItems":3}'::jsonb,
  min_check_interval_minutes = 360,
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000004';
UPDATE public.monitored_sources SET
  connector_config = connector_config || '{"maxDetailItems":3}'::jsonb,
  min_check_interval_minutes = 120,
  is_active = false,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000009';
--> statement-breakpoint
UPDATE public.monitored_sources SET is_active = false, updated_at = now();
UPDATE public.discovery_settings SET
  recurring_monitoring_enabled = false,
  automatic_drafting_enabled = false,
  deep_research_enabled = false,
  max_requests_per_day = 80,
  max_candidates_per_run = 5,
  max_candidates_per_day = 5,
  max_ai_triage_calls_per_day = 0,
  max_ai_research_calls_per_day = 0,
  max_estimated_monthly_cost_cents = 0,
  updated_at = now();
