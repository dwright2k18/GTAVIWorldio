CREATE TYPE "public"."content_type" AS ENUM('NEWS', 'FEATURE', 'ANALYSIS', 'GUIDE', 'EVERGREEN', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."correction_significance" AS ENUM('MATERIAL', 'NON_MATERIAL');--> statement-breakpoint
CREATE TYPE "public"."editor_role" AS ENUM('OWNER', 'ADMIN', 'EDITOR', 'AUTHOR', 'FACT_CHECKER');--> statement-breakpoint
CREATE TYPE "public"."evergreen_status" AS ENUM('DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');--> statement-breakpoint
CREATE TYPE "public"."story_relation_type" AS ENUM('RELATED', 'FOLLOW_UP', 'BACKGROUND', 'CORRECTION');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('FIRST_PARTY', 'PRESS_RELEASE', 'INVESTOR_REPORT', 'INTERVIEW', 'JOURNALISM', 'PUBLIC_RECORD', 'COMMUNITY_DISCOVERY', 'SOCIAL_POST', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('DISCOVERED', 'RESEARCHING', 'DRAFTING', 'NEEDS_REVIEW', 'FACT_CHECK', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'UPDATED', 'ARCHIVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('CONFIRMED', 'CREDIBLE_REPORT', 'RUMOR', 'SPECULATION', 'ALLEGED_LEAK');--> statement-breakpoint
CREATE TYPE "public"."video_kind" AS ENUM('PRIMARY', 'QUICK_HIT', 'TRAILER', 'CLIP');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"role" text,
	"profile_image_url" text,
	"profile_image_alt" text,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expertise_areas" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_code" text,
	"is_indexable" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"original_issue" text NOT NULL,
	"correction" text NOT NULL,
	"significance" "correction_significance" NOT NULL,
	"editor_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"author_id" uuid,
	"display_name" text NOT NULL,
	"role" "editor_role" DEFAULT 'AUTHOR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editor_profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "evergreen_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"search_intent" text NOT NULL,
	"summary" text NOT NULL,
	"body" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"officially_confirmed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recent_developments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "evergreen_status" DEFAULT 'DRAFT' NOT NULL,
	"seo_title_override" text,
	"meta_description_override" text,
	"canonical_override" text,
	"robots_override" text,
	"author_id" uuid,
	"last_reviewed_at" timestamp with time zone,
	"meaningfully_updated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_type" "media_type" DEFAULT 'IMAGE' NOT NULL,
	"url" text NOT NULL,
	"alt_text" text,
	"caption" text,
	"credit" text,
	"source_url" text,
	"license_notes" text,
	"width" integer,
	"height" integer,
	"mime_type" text,
	"focal_point" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_path" text NOT NULL,
	"new_path" text NOT NULL,
	"reason" text NOT NULL,
	"story_id" uuid,
	"status_code" integer DEFAULT 308 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"source_type" "source_type" DEFAULT 'OTHER' NOT NULL,
	"publication" text,
	"author_name" text,
	"source_published_at" timestamp with time zone,
	"is_first_party" boolean DEFAULT false NOT NULL,
	"reliability_notes" text,
	"verification_notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"headline" text NOT NULL,
	"slug" text NOT NULL,
	"url_path" text NOT NULL,
	"subtitle" text,
	"summary" text NOT NULL,
	"body" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"content_type" "content_type" DEFAULT 'NEWS' NOT NULL,
	"category_id" uuid,
	"subcategory" text,
	"verification_status" "verification_status" DEFAULT 'SPECULATION' NOT NULL,
	"status" "story_status" DEFAULT 'DISCOVERED' NOT NULL,
	"author_id" uuid,
	"editor_id" uuid,
	"primary_source_id" uuid,
	"original_source_published_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"scheduled_timezone" text DEFAULT 'UTC' NOT NULL,
	"meaningfully_updated_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"hero_media_id" uuid,
	"hero_image_alt" text,
	"hero_image_caption" text,
	"hero_image_credit" text,
	"featured" boolean DEFAULT false NOT NULL,
	"breaking" boolean DEFAULT false NOT NULL,
	"evergreen" boolean DEFAULT false NOT NULL,
	"trending_eligible" boolean DEFAULT false NOT NULL,
	"tiktok_url" text,
	"youtube_url" text,
	"instagram_url" text,
	"facebook_url" text,
	"canonical_override" text,
	"seo_title_override" text,
	"meta_description_override" text,
	"open_graph_title_override" text,
	"open_graph_description_override" text,
	"open_graph_image_id" uuid,
	"robots_override" text,
	"structured_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"internal_notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_evergreen_links" (
	"story_id" uuid NOT NULL,
	"evergreen_page_id" uuid NOT NULL,
	"relationship" text DEFAULT 'RELATED' NOT NULL,
	"context" text,
	CONSTRAINT "story_evergreen_links_story_id_evergreen_page_id_pk" PRIMARY KEY("story_id","evergreen_page_id")
);
--> statement-breakpoint
CREATE TABLE "story_relations" (
	"story_id" uuid NOT NULL,
	"related_story_id" uuid NOT NULL,
	"relation_type" "story_relation_type" DEFAULT 'RELATED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_relations_story_id_related_story_id_pk" PRIMARY KEY("story_id","related_story_id")
);
--> statement-breakpoint
CREATE TABLE "story_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"editor_id" uuid,
	"auth_user_id" uuid,
	"fields_changed" text[] DEFAULT '{}' NOT NULL,
	"previous_content" jsonb NOT NULL,
	"new_content" jsonb NOT NULL,
	"change_reason" text,
	"is_ai_assisted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_sources" (
	"story_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"evidence_notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "story_sources_story_id_source_id_pk" PRIMARY KEY("story_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "story_tags" (
	"story_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "story_tags_story_id_tag_id_pk" PRIMARY KEY("story_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "story_videos" (
	"story_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"relationship" text DEFAULT 'RELATED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "story_videos_story_id_video_id_pk" PRIMARY KEY("story_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_indexable" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "video_kind" DEFAULT 'PRIMARY' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_media_id" uuid,
	"uploaded_at" timestamp with time zone,
	"duration_seconds" integer,
	"platform" text,
	"embed_url" text,
	"content_url" text,
	"transcript" text,
	"captions_url" text,
	"tiktok_url" text,
	"youtube_url" text,
	"instagram_url" text,
	"facebook_url" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_editor_id_editor_profiles_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_profiles" ADD CONSTRAINT "editor_profiles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evergreen_pages" ADD CONSTRAINT "evergreen_pages_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_editor_id_editor_profiles_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_primary_source_id_sources_id_fk" FOREIGN KEY ("primary_source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_hero_media_id_media_assets_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_open_graph_image_id_media_assets_id_fk" FOREIGN KEY ("open_graph_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_evergreen_links" ADD CONSTRAINT "story_evergreen_links_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_evergreen_links" ADD CONSTRAINT "story_evergreen_links_evergreen_page_id_evergreen_pages_id_fk" FOREIGN KEY ("evergreen_page_id") REFERENCES "public"."evergreen_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_relations" ADD CONSTRAINT "story_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_relations" ADD CONSTRAINT "story_relations_related_story_id_stories_id_fk" FOREIGN KEY ("related_story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_revisions" ADD CONSTRAINT "story_revisions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_revisions" ADD CONSTRAINT "story_revisions_editor_id_editor_profiles_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_tags" ADD CONSTRAINT "story_tags_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_tags" ADD CONSTRAINT "story_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_videos" ADD CONSTRAINT "story_videos_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_videos" ADD CONSTRAINT "story_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_thumbnail_media_id_media_assets_id_fk" FOREIGN KEY ("thumbnail_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_slug_lower_uidx" ON "authors" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_code_lower_uidx" ON "categories" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_lower_uidx" ON "categories" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "corrections_story_date_idx" ON "corrections" USING btree ("story_id","corrected_at");--> statement-breakpoint
CREATE INDEX "editor_profiles_role_idx" ON "editor_profiles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "evergreen_pages_path_lower_uidx" ON "evergreen_pages" USING btree (lower("path"));--> statement-breakpoint
CREATE UNIQUE INDEX "evergreen_pages_slug_lower_uidx" ON "evergreen_pages" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "evergreen_status_reviewed_idx" ON "evergreen_pages" USING btree ("status","last_reviewed_at");--> statement-breakpoint
CREATE INDEX "media_assets_type_idx" ON "media_assets" USING btree ("media_type");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_old_path_lower_uidx" ON "redirects" USING btree (lower("old_path"));--> statement-breakpoint
CREATE INDEX "redirects_story_idx" ON "redirects" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_url_uidx" ON "sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "sources_type_idx" ON "sources" USING btree ("source_type");--> statement-breakpoint
CREATE UNIQUE INDEX "stories_slug_lower_uidx" ON "stories" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "stories_url_path_lower_uidx" ON "stories" USING btree (lower("url_path"));--> statement-breakpoint
CREATE INDEX "stories_status_published_idx" ON "stories" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "stories_category_published_idx" ON "stories" USING btree ("category_id","published_at");--> statement-breakpoint
CREATE INDEX "stories_verification_idx" ON "stories" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "stories_updated_idx" ON "stories" USING btree ("meaningfully_updated_at");--> statement-breakpoint
CREATE INDEX "stories_scheduled_idx" ON "stories" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "stories_featured_idx" ON "stories" USING btree ("featured","published_at");--> statement-breakpoint
CREATE INDEX "stories_breaking_idx" ON "stories" USING btree ("breaking","published_at");--> statement-breakpoint
CREATE INDEX "story_evergreen_page_idx" ON "story_evergreen_links" USING btree ("evergreen_page_id");--> statement-breakpoint
CREATE INDEX "story_relations_related_idx" ON "story_relations" USING btree ("related_story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_revisions_number_uidx" ON "story_revisions" USING btree ("story_id","revision_number");--> statement-breakpoint
CREATE INDEX "story_revisions_story_date_idx" ON "story_revisions" USING btree ("story_id","created_at");--> statement-breakpoint
CREATE INDEX "story_sources_source_idx" ON "story_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "story_tags_tag_idx" ON "story_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "story_videos_video_idx" ON "story_videos" USING btree ("video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_lower_uidx" ON "tags" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "videos_kind_published_idx" ON "videos" USING btree ("kind","is_published");
--> statement-breakpoint
ALTER TABLE "editor_profiles"
  ADD CONSTRAINT "editor_profiles_auth_user_id_fkey"
  FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id")
  ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "stories"
  ADD CONSTRAINT "stories_url_path_format_check"
  CHECK ("url_path" ~ '^/[a-z0-9][a-z0-9/_-]*$' AND "url_path" !~ '//');
--> statement-breakpoint
ALTER TABLE "evergreen_pages"
  ADD CONSTRAINT "evergreen_path_format_check"
  CHECK ("path" ~ '^/[a-z0-9][a-z0-9/_-]*$' AND "path" !~ '//');
--> statement-breakpoint
ALTER TABLE "redirects"
  ADD CONSTRAINT "redirects_path_format_check"
  CHECK (
    "old_path" ~ '^/[a-z0-9][a-z0-9/_-]*$'
    AND "new_path" ~ '^/[a-z0-9][a-z0-9/_-]*$'
    AND "old_path" <> "new_path"
    AND "status_code" IN (301, 308)
  );
--> statement-breakpoint
ALTER TABLE "story_relations"
  ADD CONSTRAINT "story_relations_not_self_check"
  CHECK ("story_id" <> "related_story_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "story_sources_one_primary_uidx"
  ON "story_sources" ("story_id") WHERE "is_primary" = true;
--> statement-breakpoint
CREATE INDEX "stories_live_publication_idx"
  ON "stories" ("published_at" DESC)
  WHERE "status" IN ('PUBLISHED', 'UPDATED');
--> statement-breakpoint
CREATE INDEX "stories_search_gin_idx"
  ON "stories" USING gin (
    to_tsvector(
      'english',
      coalesce("headline", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("body_text", '') || ' ' || coalesce("subcategory", '')
    )
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_newsroom_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER authors_set_updated_at BEFORE UPDATE ON public.authors
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER editor_profiles_set_updated_at BEFORE UPDATE ON public.editor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER evergreen_pages_set_updated_at BEFORE UPDATE ON public.evergreen_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER media_assets_set_updated_at BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER sources_set_updated_at BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER stories_set_updated_at BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER tags_set_updated_at BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER videos_set_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.validate_story_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'SCHEDULED' AND NEW.scheduled_for IS NULL THEN
    RAISE EXCEPTION 'Scheduled stories require a scheduled publication time';
  END IF;

  IF NEW.status IN ('PUBLISHED', 'UPDATED') THEN
    IF NEW.published_at IS NULL OR NEW.author_id IS NULL OR NEW.primary_source_id IS NULL THEN
      RAISE EXCEPTION 'Published stories require publish date, author, and primary source';
    END IF;

    IF jsonb_array_length(NEW.body) = 0 OR length(trim(NEW.summary)) < 40 THEN
      RAISE EXCEPTION 'Published stories require an article body and substantive summary';
    END IF;
  END IF;

  IF NEW.robots_override IS NOT NULL AND NEW.robots_override NOT IN ('index,follow', 'noindex,nofollow') THEN
    RAISE EXCEPTION 'Invalid robots override';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER stories_validate_workflow
  BEFORE INSERT OR UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.validate_story_workflow();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.log_story_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  changed_fields text[];
  editor_profile_id uuid;
  current_auth_user uuid;
  revision_reason text;
  ai_assisted boolean;
BEGIN
  SELECT array_agg(new_values.key ORDER BY new_values.key)
  INTO changed_fields
  FROM jsonb_each(to_jsonb(NEW)) AS new_values
  JOIN jsonb_each(to_jsonb(OLD)) AS old_values USING (key)
  WHERE new_values.value IS DISTINCT FROM old_values.value
    AND new_values.key NOT IN ('updated_at');

  IF coalesce(array_length(changed_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  current_auth_user := auth.uid();
  editor_profile_id := nullif(current_setting('app.editor_profile_id', true), '')::uuid;
  revision_reason := nullif(current_setting('app.revision_reason', true), '');
  ai_assisted := coalesce(nullif(current_setting('app.ai_assisted', true), '')::boolean, false);

  IF editor_profile_id IS NULL AND current_auth_user IS NOT NULL THEN
    SELECT id INTO editor_profile_id
    FROM public.editor_profiles
    WHERE auth_user_id = current_auth_user AND is_active = true;
  END IF;

  INSERT INTO public.story_revisions (
    story_id,
    revision_number,
    editor_id,
    auth_user_id,
    fields_changed,
    previous_content,
    new_content,
    change_reason,
    is_ai_assisted
  ) VALUES (
    NEW.id,
    coalesce((SELECT max(revision_number) + 1 FROM public.story_revisions WHERE story_id = NEW.id), 1),
    editor_profile_id,
    current_auth_user,
    changed_fields,
    to_jsonb(OLD),
    to_jsonb(NEW),
    revision_reason,
    ai_assisted
  );

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER stories_revision_log
  AFTER UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.log_story_revision();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.prevent_redirect_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.redirects
    WHERE is_active = true
      AND lower(old_path) = lower(NEW.new_path)
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Redirect chains are not allowed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.redirects
    WHERE is_active = true
      AND lower(new_path) = lower(NEW.old_path)
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Redirect loops are not allowed';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER redirects_prevent_chain
  BEFORE INSERT OR UPDATE ON public.redirects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_redirect_chain();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_newsroom_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.editor_profiles
    WHERE auth_user_id = auth.uid() AND is_active = true
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_newsroom_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.editor_profiles
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role IN ('OWNER', 'ADMIN')
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_newsroom_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_newsroom_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_newsroom_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_newsroom_admin() TO authenticated;
--> statement-breakpoint
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evergreen_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_evergreen_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "newsroom members manage authors" ON public.authors
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage categories" ON public.categories
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage corrections" ON public.corrections
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "profiles read own record" ON public.editor_profiles
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR public.is_newsroom_admin());
CREATE POLICY "admins manage profiles" ON public.editor_profiles
  FOR ALL TO authenticated USING (public.is_newsroom_admin()) WITH CHECK (public.is_newsroom_admin());
CREATE POLICY "newsroom members manage evergreen pages" ON public.evergreen_pages
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage media" ON public.media_assets
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage redirects" ON public.redirects
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage sources" ON public.sources
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage stories" ON public.stories
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage evergreen links" ON public.story_evergreen_links
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage story relations" ON public.story_relations
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members read revisions" ON public.story_revisions
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "newsroom members create revisions" ON public.story_revisions
  FOR INSERT TO authenticated WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage story sources" ON public.story_sources
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage story tags" ON public.story_tags
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage story videos" ON public.story_videos
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage tags" ON public.tags
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage videos" ON public.videos
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
