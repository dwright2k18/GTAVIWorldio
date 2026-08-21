CREATE OR REPLACE FUNCTION public.protect_story_api_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_role public.editor_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  actor_role := public.newsroom_role();
  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'Active newsroom access is required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Story creator attribution is immutable through the public API' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND actor_role = 'EDITOR' THEN
    IF NEW.editor_id IS DISTINCT FROM OLD.editor_id
      AND NEW.editor_id IS DISTINCT FROM public.current_editor_profile_id()
    THEN
      RAISE EXCEPTION 'Editors cannot impersonate another story editor' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND actor_role IN ('AUTHOR', 'FACT_CHECKER') THEN
    IF NEW.editor_id IS DISTINCT FROM OLD.editor_id
      OR (actor_role = 'FACT_CHECKER' AND NEW.author_id IS DISTINCT FROM OLD.author_id)
      OR NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
      OR NEW.featured IS DISTINCT FROM OLD.featured
      OR NEW.breaking IS DISTINCT FROM OLD.breaking
      OR NEW.trending_eligible IS DISTINCT FROM OLD.trending_eligible
      OR NEW.canonical_override IS DISTINCT FROM OLD.canonical_override
      OR NEW.robots_override IS DISTINCT FROM OLD.robots_override
    THEN
      RAISE EXCEPTION 'This newsroom role cannot modify protected publishing fields' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_created_by_api_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Creator attribution is immutable through the public API' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_created_by_api_field() FROM PUBLIC;
DROP TRIGGER IF EXISTS sources_protect_created_by ON public.sources;
CREATE TRIGGER sources_protect_created_by
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_by_api_field();
DROP TRIGGER IF EXISTS media_assets_protect_created_by ON public.media_assets;
CREATE TRIGGER media_assets_protect_created_by
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_by_api_field();
DROP TRIGGER IF EXISTS videos_protect_created_by ON public.videos;
CREATE TRIGGER videos_protect_created_by
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_by_api_field();
DROP TRIGGER IF EXISTS redirects_protect_created_by ON public.redirects;
CREATE TRIGGER redirects_protect_created_by
  BEFORE UPDATE ON public.redirects
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_by_api_field();
