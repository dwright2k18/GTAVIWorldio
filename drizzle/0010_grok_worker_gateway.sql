BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  CREATE TYPE public.grok_worker_status AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.grok_work_kind AS ENUM (
    'RESEARCH', 'DRAFT', 'FACT_CHECK', 'SEO', 'PRIMARY_VIDEO', 'QUICK_HIT', 'REVISION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.grok_work_status AS ENUM (
    'READY', 'LEASED', 'VALIDATING', 'NEEDS_REVISION', 'COMPLETED', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.grok_artifact_kind AS ENUM (
    'RESEARCH_PACKET', 'CLAIM_EVIDENCE_MAP', 'QUOTE_PROVENANCE', 'ARTICLE_DRAFT',
    'GROUNDING_RESULT', 'FACT_CHECK_RESULT', 'SEO_PACKAGE',
    'PRIMARY_VIDEO_PACKAGE', 'QUICK_HIT_PACKAGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.grok_submission_status AS ENUM ('ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.grok_policy_decision AS ENUM ('BLOCKED', 'ELIGIBLE', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.grok_automation_controls (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  api_enabled boolean NOT NULL DEFAULT false,
  queue_enabled boolean NOT NULL DEFAULT false,
  auto_publish_enabled boolean NOT NULL DEFAULT false,
  emergency_stop boolean NOT NULL DEFAULT true,
  daily_publication_cap integer NOT NULL DEFAULT 0 CHECK (daily_publication_cap >= 0),
  default_author_id uuid REFERENCES public.authors(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.grok_automation_controls (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.grok_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status public.grok_worker_status NOT NULL DEFAULT 'DISABLED',
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'preview', 'development')),
  max_concurrent_leases integer NOT NULL DEFAULT 1 CHECK (max_concurrent_leases BETWEEN 1 AND 2),
  token_version integer NOT NULL DEFAULT 1 CHECK (token_version > 0),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS grok_workers_name_environment_uidx
  ON public.grok_workers (lower(name), environment);

CREATE TABLE IF NOT EXISTS public.grok_worker_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.grok_workers(id) ON DELETE CASCADE,
  token_prefix text NOT NULL UNIQUE CHECK (token_prefix ~ '^gwk_[a-z0-9]{12}$'),
  token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  token_version integer NOT NULL CHECK (token_version > 0),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  rotated_from_id uuid REFERENCES public.grok_worker_credentials(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(scopes) > 0)
);

CREATE INDEX IF NOT EXISTS grok_worker_credentials_worker_idx
  ON public.grok_worker_credentials(worker_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.grok_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  kind public.grok_work_kind NOT NULL,
  status public.grok_work_status NOT NULL DEFAULT 'READY',
  priority integer NOT NULL DEFAULT 0,
  not_before timestamptz NOT NULL DEFAULT now(),
  input_snapshot_hash text NOT NULL CHECK (input_snapshot_hash ~ '^[0-9a-f]{64}$'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  parent_work_item_id uuid REFERENCES public.grok_work_items(id) ON DELETE SET NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  last_error_code text,
  last_error_message text,
  created_by uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, kind, revision)
);

CREATE INDEX IF NOT EXISTS grok_work_items_ready_idx
  ON public.grok_work_items(status, not_before, priority DESC, created_at);

CREATE TABLE IF NOT EXISTS public.grok_work_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.grok_work_items(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.grok_workers(id) ON DELETE RESTRICT,
  credential_id uuid NOT NULL REFERENCES public.grok_worker_credentials(id) ON DELETE RESTRICT,
  lease_token_digest text NOT NULL UNIQUE CHECK (lease_token_digest ~ '^[0-9a-f]{64}$'),
  leased_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  release_reason text,
  CHECK (expires_at > leased_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS grok_work_leases_active_item_uidx
  ON public.grok_work_leases(work_item_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS grok_work_leases_worker_active_idx
  ON public.grok_work_leases(worker_id, expires_at) WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS public.grok_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.grok_work_items(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.grok_workers(id) ON DELETE RESTRICT,
  credential_id uuid NOT NULL REFERENCES public.grok_worker_credentials(id) ON DELETE RESTRICT,
  artifact_kind public.grok_artifact_kind NOT NULL,
  schema_version text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  input_snapshot_hash text NOT NULL CHECK (input_snapshot_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text NOT NULL,
  status public.grok_submission_status NOT NULL,
  validation_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credential_id, idempotency_key),
  UNIQUE (work_item_id, artifact_kind, revision)
);

CREATE INDEX IF NOT EXISTS grok_submissions_candidate_kind_idx
  ON public.grok_submissions(candidate_id, artifact_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.grok_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.grok_submissions(id) ON DELETE CASCADE,
  validation_type text NOT NULL CHECK (validation_type IN (
    'SCHEMA', 'CLAIM_EVIDENCE', 'QUOTE_PROVENANCE', 'GROUNDING', 'FACT_CHECK',
    'COPYRIGHT', 'SEO', 'DUPLICATE', 'SOURCE_GAP'
  )),
  validator_version text NOT NULL,
  input_snapshot_hash text NOT NULL,
  passed boolean NOT NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, validation_type, validator_version)
);

CREATE TABLE IF NOT EXISTS public.grok_publication_daily_counters (
  usage_date date PRIMARY KEY,
  publication_cap integer NOT NULL DEFAULT 0 CHECK (publication_cap >= 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  published_count integer NOT NULL DEFAULT 0 CHECK (published_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (published_count <= reserved_count),
  CHECK (reserved_count <= publication_cap)
);

CREATE TABLE IF NOT EXISTS public.grok_publication_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  draft_submission_id uuid NOT NULL REFERENCES public.grok_submissions(id) ON DELETE RESTRICT,
  policy_version text NOT NULL,
  decision public.grok_policy_decision NOT NULL,
  all_gates_passed boolean NOT NULL,
  gate_snapshot jsonb NOT NULL,
  evidence_snapshot_hash text NOT NULL,
  story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grok_publication_draft_policy_idx
  ON public.grok_publication_evaluations(draft_submission_id, policy_version, created_at DESC);

CREATE TABLE IF NOT EXISTS public.grok_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.grok_worker_credentials(id) ON DELETE CASCADE,
  route_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (credential_id, route_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS grok_idempotency_expiry_idx
  ON public.grok_idempotency_records(expires_at);

CREATE TABLE IF NOT EXISTS public.grok_rate_limit_buckets (
  worker_id uuid NOT NULL REFERENCES public.grok_workers(id) ON DELETE CASCADE,
  scope text NOT NULL,
  bucket_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_id, scope, bucket_start)
);

CREATE INDEX IF NOT EXISTS grok_rate_limit_bucket_expiry_idx
  ON public.grok_rate_limit_buckets(bucket_start);

CREATE TABLE IF NOT EXISTS public.grok_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.grok_workers(id) ON DELETE SET NULL,
  credential_id uuid REFERENCES public.grok_worker_credentials(id) ON DELETE SET NULL,
  work_item_id uuid REFERENCES public.grok_work_items(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  action text NOT NULL,
  request_id text NOT NULL,
  request_hash text,
  outcome text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grok_audit_events_candidate_date_idx
  ON public.grok_audit_events(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS grok_audit_events_worker_date_idx
  ON public.grok_audit_events(worker_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.grok_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED')),
  worker_id uuid REFERENCES public.grok_workers(id) ON DELETE SET NULL,
  work_item_id uuid REFERENCES public.grok_work_items(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  detail text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.editor_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS grok_alerts_open_idx
  ON public.grok_alerts(status, severity, created_at DESC);

CREATE OR REPLACE FUNCTION private.prevent_grok_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Grok submissions, validations, and audit events are append-only';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_grok_immutable_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS grok_submissions_immutable ON public.grok_submissions;
CREATE TRIGGER grok_submissions_immutable
  BEFORE UPDATE OR DELETE ON public.grok_submissions
  FOR EACH ROW EXECUTE FUNCTION private.prevent_grok_immutable_mutation();

DROP TRIGGER IF EXISTS grok_validation_runs_immutable ON public.grok_validation_runs;
CREATE TRIGGER grok_validation_runs_immutable
  BEFORE UPDATE OR DELETE ON public.grok_validation_runs
  FOR EACH ROW EXECUTE FUNCTION private.prevent_grok_immutable_mutation();

DROP TRIGGER IF EXISTS grok_audit_events_immutable ON public.grok_audit_events;
CREATE TRIGGER grok_audit_events_immutable
  BEFORE UPDATE OR DELETE ON public.grok_audit_events
  FOR EACH ROW EXECUTE FUNCTION private.prevent_grok_immutable_mutation();

CREATE OR REPLACE FUNCTION private.grok_lease_work(
  p_worker_id uuid,
  p_credential_id uuid,
  p_lease_token_digest text,
  p_lease_seconds integer DEFAULT 1800
)
RETURNS TABLE(work_item_id uuid, candidate_id uuid, kind public.grok_work_kind, input_snapshot_hash text, revision integer, lease_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.grok_work_items%ROWTYPE;
  v_max_leases integer;
BEGIN
  IF p_lease_seconds < 300 OR p_lease_seconds > 7200 THEN
    RAISE EXCEPTION 'Lease duration is outside the allowed range';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.grok_automation_controls
    WHERE singleton = true AND api_enabled AND queue_enabled AND NOT emergency_stop
  ) THEN
    RAISE EXCEPTION 'Grok worker queue is disabled';
  END IF;

  SELECT max_concurrent_leases INTO v_max_leases
  FROM public.grok_workers
  WHERE id = p_worker_id AND status = 'ACTIVE' AND revoked_at IS NULL
  FOR UPDATE;

  IF v_max_leases IS NULL THEN RAISE EXCEPTION 'Worker is not active'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.grok_worker_credentials
    WHERE id = p_credential_id AND worker_id = p_worker_id
      AND revoked_at IS NULL AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Credential is not active';
  END IF;

  UPDATE public.grok_work_leases
  SET released_at = now(), release_reason = 'LEASE_EXPIRED'
  WHERE released_at IS NULL AND expires_at <= now();

  UPDATE public.grok_work_items w
  SET status = 'READY', updated_at = now()
  WHERE status = 'LEASED'
    AND NOT EXISTS (
      SELECT 1 FROM public.grok_work_leases l
      WHERE l.work_item_id = w.id AND l.released_at IS NULL AND l.expires_at > now()
    );

  IF (
    SELECT count(*) FROM public.grok_work_leases
    WHERE worker_id = p_worker_id AND released_at IS NULL AND expires_at > now()
  ) >= v_max_leases THEN
    RETURN;
  END IF;

  SELECT * INTO v_item
  FROM public.grok_work_items
  WHERE status = 'READY' AND not_before <= now() AND attempts < max_attempts
  ORDER BY priority DESC, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_item.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.grok_work_leases (
    work_item_id, worker_id, credential_id, lease_token_digest, expires_at
  ) VALUES (
    v_item.id, p_worker_id, p_credential_id, p_lease_token_digest,
    now() + make_interval(secs => p_lease_seconds)
  );

  UPDATE public.grok_work_items
  SET status = 'LEASED', attempts = attempts + 1, updated_at = now()
  WHERE id = v_item.id;

  UPDATE public.grok_workers SET last_seen_at = now(), updated_at = now()
  WHERE id = p_worker_id;

  RETURN QUERY SELECT v_item.id, v_item.candidate_id, v_item.kind,
    v_item.input_snapshot_hash, v_item.revision,
    now() + make_interval(secs => p_lease_seconds);
END;
$$;

REVOKE ALL ON FUNCTION private.grok_lease_work(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.grok_automation_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_worker_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_work_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_publication_daily_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_publication_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grok_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.grok_automation_controls, public.grok_workers,
  public.grok_worker_credentials, public.grok_work_items, public.grok_work_leases,
  public.grok_submissions, public.grok_validation_runs,
  public.grok_publication_daily_counters, public.grok_publication_evaluations,
  public.grok_idempotency_records, public.grok_rate_limit_buckets,
  public.grok_audit_events, public.grok_alerts FROM PUBLIC, anon, authenticated;

COMMIT;
