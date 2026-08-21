CREATE OR REPLACE FUNCTION public.newsroom_role()
RETURNS public.editor_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role
  FROM public.editor_profiles
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_editor_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id
  FROM public.editor_profiles
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_editor_author_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT author_id
  FROM public.editor_profiles
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_newsroom_role(VARIADIC allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT coalesce(public.newsroom_role()::text = ANY(allowed_roles), false);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_newsroom_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.newsroom_role() IS NOT NULL;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_newsroom_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_newsroom_role('OWNER', 'ADMIN');
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.can_read_story(target_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.editor_profiles profile
    JOIN public.stories story ON story.id = target_story_id
    WHERE profile.auth_user_id = auth.uid()
      AND profile.is_active = true
      AND (
        profile.role IN ('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
        OR (
          profile.role = 'AUTHOR'
          AND (
            story.created_by = profile.id
            OR story.status IN ('PUBLISHED', 'UPDATED')
          )
        )
      )
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.can_author_story(target_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.editor_profiles profile
    JOIN public.stories story ON story.id = target_story_id
    WHERE profile.auth_user_id = auth.uid()
      AND profile.is_active = true
      AND profile.role = 'AUTHOR'
      AND story.created_by = profile.id
      AND story.status IN ('DISCOVERED', 'RESEARCHING', 'DRAFTING', 'NEEDS_REVIEW')
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.can_fact_check_story(target_story_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.editor_profiles profile
    JOIN public.stories story ON story.id = target_story_id
    WHERE profile.auth_user_id = auth.uid()
      AND profile.is_active = true
      AND profile.role = 'FACT_CHECKER'
      AND story.status IN ('NEEDS_REVIEW', 'FACT_CHECK')
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.newsroom_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_editor_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_editor_author_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_newsroom_role(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_newsroom_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_newsroom_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_story(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_author_story(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_fact_check_story(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsroom_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_editor_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_editor_author_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_newsroom_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_newsroom_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_newsroom_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_story(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_author_story(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_fact_check_story(uuid) TO authenticated;
--> statement-breakpoint
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

  IF TG_OP = 'UPDATE' AND actor_role = 'EDITOR' THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
      OR (
        NEW.editor_id IS DISTINCT FROM OLD.editor_id
        AND NEW.editor_id IS DISTINCT FROM public.current_editor_profile_id()
      )
    THEN
      RAISE EXCEPTION 'Editors cannot rewrite protected story attribution' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND actor_role IN ('AUTHOR', 'FACT_CHECKER') THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.editor_id IS DISTINCT FROM OLD.editor_id
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
REVOKE ALL ON FUNCTION public.protect_story_api_fields() FROM PUBLIC;
DROP TRIGGER IF EXISTS stories_protect_api_fields ON public.stories;
CREATE TRIGGER stories_protect_api_fields
  BEFORE INSERT OR UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.protect_story_api_fields();
--> statement-breakpoint
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'authors', 'categories', 'corrections', 'editor_profiles',
        'evergreen_pages', 'evergreen_revisions', 'evergreen_sources',
        'media_assets', 'redirects', 'sources', 'stories',
        'story_evergreen_links', 'story_relations', 'story_revisions',
        'story_sources', 'story_tags', 'story_videos', 'tags', 'videos'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE POLICY "members read authors" ON public.authors
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors insert authors" ON public.authors
  FOR INSERT TO authenticated WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "editors update authors" ON public.authors
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete authors" ON public.authors
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read categories" ON public.categories
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "editors update categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete categories" ON public.categories
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read tags" ON public.tags
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors insert tags" ON public.tags
  FOR INSERT TO authenticated WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "editors update tags" ON public.tags
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete tags" ON public.tags
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read profiles" ON public.editor_profiles
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read sources" ON public.sources
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "reviewers insert sources" ON public.sources
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
    AND created_by = public.current_editor_profile_id()
  );
CREATE POLICY "reviewers update sources" ON public.sources
  FOR UPDATE TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER'));
CREATE POLICY "admins delete sources" ON public.sources
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read media" ON public.media_assets
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors insert media" ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND created_by = public.current_editor_profile_id()
  );
CREATE POLICY "editors update media" ON public.media_assets
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete media" ON public.media_assets
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read videos" ON public.videos
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors insert videos" ON public.videos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND created_by = public.current_editor_profile_id()
  );
CREATE POLICY "editors update videos" ON public.videos
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete videos" ON public.videos
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "role scoped story reads" ON public.stories
  FOR SELECT TO authenticated USING (public.can_read_story(id));
CREATE POLICY "editors insert stories" ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND created_by = public.current_editor_profile_id()
    AND editor_id = public.current_editor_profile_id()
  );
CREATE POLICY "authors insert own drafts" ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('AUTHOR')
    AND created_by = public.current_editor_profile_id()
    AND editor_id = public.current_editor_profile_id()
    AND (author_id IS NULL OR author_id = public.current_editor_author_id())
    AND status IN ('DISCOVERED', 'RESEARCHING', 'DRAFTING', 'NEEDS_REVIEW')
    AND published_at IS NULL
    AND scheduled_for IS NULL
    AND featured = false
    AND breaking = false
    AND trending_eligible = false
    AND canonical_override IS NULL
    AND robots_override IS NULL
  );
CREATE POLICY "editors update stories" ON public.stories
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "authors update own drafts" ON public.stories
  FOR UPDATE TO authenticated
  USING (public.can_author_story(id))
  WITH CHECK (
    public.has_newsroom_role('AUTHOR')
    AND created_by = public.current_editor_profile_id()
    AND editor_id = public.current_editor_profile_id()
    AND (author_id IS NULL OR author_id = public.current_editor_author_id())
    AND status IN ('DISCOVERED', 'RESEARCHING', 'DRAFTING', 'NEEDS_REVIEW')
    AND published_at IS NULL
    AND scheduled_for IS NULL
    AND featured = false
    AND breaking = false
    AND trending_eligible = false
    AND canonical_override IS NULL
    AND robots_override IS NULL
  );
CREATE POLICY "fact checkers update review stories" ON public.stories
  FOR UPDATE TO authenticated
  USING (public.can_fact_check_story(id))
  WITH CHECK (
    public.has_newsroom_role('FACT_CHECKER')
    AND status IN ('NEEDS_REVIEW', 'FACT_CHECK')
  );
CREATE POLICY "admins delete stories" ON public.stories
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read corrections" ON public.corrections
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "reviewers insert corrections" ON public.corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
    AND editor_id = public.current_editor_profile_id()
    AND public.can_read_story(story_id)
  );

CREATE POLICY "members read evergreen pages" ON public.evergreen_pages
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors insert evergreen pages" ON public.evergreen_pages
  FOR INSERT TO authenticated WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "editors update evergreen pages" ON public.evergreen_pages
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete evergreen pages" ON public.evergreen_pages
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "members read redirects" ON public.redirects
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors insert redirects" ON public.redirects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND created_by = public.current_editor_profile_id()
  );
CREATE POLICY "editors update redirects" ON public.redirects
  FOR UPDATE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete redirects" ON public.redirects
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));
--> statement-breakpoint
CREATE POLICY "role scoped story tag reads" ON public.story_tags
  FOR SELECT TO authenticated USING (public.can_read_story(story_id));
CREATE POLICY "story owners manage tags" ON public.story_tags
  FOR ALL TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id));

CREATE POLICY "role scoped story relation reads" ON public.story_relations
  FOR SELECT TO authenticated USING (public.can_read_story(story_id));
CREATE POLICY "story owners manage relations" ON public.story_relations
  FOR ALL TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id));

CREATE POLICY "role scoped story video reads" ON public.story_videos
  FOR SELECT TO authenticated USING (public.can_read_story(story_id));
CREATE POLICY "story owners manage videos" ON public.story_videos
  FOR ALL TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id));

CREATE POLICY "role scoped story evergreen reads" ON public.story_evergreen_links
  FOR SELECT TO authenticated USING (public.can_read_story(story_id));
CREATE POLICY "story owners manage evergreen links" ON public.story_evergreen_links
  FOR ALL TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR') OR public.can_author_story(story_id));

CREATE POLICY "role scoped story source reads" ON public.story_sources
  FOR SELECT TO authenticated USING (public.can_read_story(story_id));
CREATE POLICY "story reviewers manage sources" ON public.story_sources
  FOR ALL TO authenticated
  USING (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    OR public.can_author_story(story_id)
    OR public.can_fact_check_story(story_id)
  )
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    OR public.can_author_story(story_id)
    OR public.can_fact_check_story(story_id)
  );

CREATE POLICY "role scoped revision reads" ON public.story_revisions
  FOR SELECT TO authenticated USING (public.can_read_story(story_id));

CREATE POLICY "members read evergreen sources" ON public.evergreen_sources
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "editors manage evergreen sources" ON public.evergreen_sources
  FOR ALL TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));

CREATE POLICY "members read evergreen revisions" ON public.evergreen_revisions
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON
  public.authors,
  public.categories,
  public.corrections,
  public.editor_profiles,
  public.evergreen_pages,
  public.evergreen_revisions,
  public.evergreen_sources,
  public.media_assets,
  public.redirects,
  public.sources,
  public.stories,
  public.story_evergreen_links,
  public.story_relations,
  public.story_revisions,
  public.story_sources,
  public.story_tags,
  public.story_videos,
  public.tags,
  public.videos
TO authenticated;
GRANT INSERT ON public.corrections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON
  public.authors,
  public.categories,
  public.evergreen_pages,
  public.evergreen_sources,
  public.media_assets,
  public.redirects,
  public.sources,
  public.stories,
  public.story_evergreen_links,
  public.story_relations,
  public.story_sources,
  public.story_tags,
  public.story_videos,
  public.tags,
  public.videos
TO authenticated;
