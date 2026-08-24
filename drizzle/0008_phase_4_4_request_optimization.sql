ALTER TABLE public.monitored_sources
  ADD COLUMN IF NOT EXISTS http_cache jsonb NOT NULL DEFAULT '{}'::jsonb;
