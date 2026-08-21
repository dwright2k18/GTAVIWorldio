CREATE TYPE "public"."candidate_status" AS ENUM('DISCOVERED', 'TRIAGED', 'RESEARCHING', 'DUPLICATE', 'REJECTED', 'PROMOTED_TO_STORY', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."cluster_status" AS ENUM('OPEN', 'MONITORING', 'RESOLVED', 'MERGED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."discovery_actor_type" AS ENUM('MANUAL', 'AUTOMATION');--> statement-breakpoint
CREATE TYPE "public"."discovery_alert_status" AS ENUM('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."discovery_alert_type" AS ENUM('URGENT_OFFICIAL_UPDATE', 'HIGH_VALUE_SEO_OPPORTUNITY', 'POSSIBLE_DUPLICATE', 'CONFLICTING_SOURCES', 'ALLEGED_LEAK_TRENDING', 'EVERGREEN_PAGE_NEEDS_UPDATE', 'SOURCE_CONNECTOR_FAILURE', 'COST_LIMIT_WARNING');--> statement-breakpoint
CREATE TYPE "public"."duplicate_status" AS ENUM('NEW_STORY', 'RELATED', 'LIKELY_DUPLICATE', 'DUPLICATE');--> statement-breakpoint
CREATE TYPE "public"."fetch_run_status" AS ENUM('SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED', 'CIRCUIT_OPEN', 'TEST_ONLY');--> statement-breakpoint
CREATE TYPE "public"."media_rights_status" AS ENUM('OFFICIAL_EMBEDDABLE', 'OWNED', 'LICENSED', 'COMMENTARY_ONLY', 'DO_NOT_HOST', 'UNKNOWN_RIGHTS');--> statement-breakpoint
CREATE TYPE "public"."source_authority_tier" AS ENUM('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4');--> statement-breakpoint
CREATE TYPE "public"."source_change_type" AS ENUM('NEW_ARTICLE', 'TEXT_UPDATE', 'RELEASE_DATE_CHANGE', 'PLATFORM_CHANGE', 'PRICE_CHANGE', 'PREORDER_CHANGE', 'TRAILER_ADDED', 'SCREENSHOT_ADDED', 'METADATA_CHANGE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."source_connector_kind" AS ENUM('RSS', 'ATOM', 'HTML_LISTING', 'HTML_CHANGE', 'JSON_FEED', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."source_health_status" AS ENUM('NOT_CHECKED', 'HEALTHY', 'DEGRADED', 'FAILED', 'PAUSED', 'CIRCUIT_OPEN');--> statement-breakpoint
CREATE TABLE "candidate_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"source_id" uuid,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"published_at" timestamp with time zone,
	"authority_tier" "source_authority_tier" NOT NULL,
	"authority_score" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_corroborating" boolean DEFAULT false NOT NULL,
	"extracted_facts" text[] DEFAULT '{}' NOT NULL,
	"exact_quotes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_notes" text,
	"rights_notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"cluster_id" uuid,
	"source_id" uuid,
	"alert_type" "discovery_alert_type" NOT NULL,
	"status" "discovery_alert_status" DEFAULT 'NEW' NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"cluster_id" uuid,
	"story_id" uuid,
	"actor_id" uuid,
	"actor_type" "discovery_actor_type" NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_id" uuid,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"source_url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"source_author" text,
	"source_published_at" timestamp with time zone,
	"excerpt" text,
	"source_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"change_type" "source_change_type" DEFAULT 'NEW_ARTICLE' NOT NULL,
	"status" "candidate_status" DEFAULT 'DISCOVERED' NOT NULL,
	"duplicate_status" "duplicate_status" DEFAULT 'NEW_STORY' NOT NULL,
	"verification_recommendation" "verification_status" DEFAULT 'SPECULATION' NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"newsworthiness_score" integer DEFAULT 0 NOT NULL,
	"seo_opportunity_score" integer DEFAULT 0 NOT NULL,
	"trend_score" integer DEFAULT 0 NOT NULL,
	"content_opportunity_score" integer DEFAULT 0 NOT NULL,
	"quick_hit_score" integer DEFAULT 0 NOT NULL,
	"primary_video_score" integer DEFAULT 0 NOT NULL,
	"primary_topic" text,
	"secondary_topics" text[] DEFAULT '{}' NOT NULL,
	"search_intent" text,
	"suggested_keywords" text[] DEFAULT '{}' NOT NULL,
	"evergreen_update_recommended" boolean DEFAULT false NOT NULL,
	"evergreen_page_id" uuid,
	"evergreen_recommendation" text,
	"internal_link_suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"known_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uncertainties" text[] DEFAULT '{}' NOT NULL,
	"exact_quotes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conflicting_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"community_questions" text[] DEFAULT '{}' NOT NULL,
	"research_notes" text,
	"suggested_headline" text,
	"suggested_summary" text,
	"suggested_seo_title" text,
	"suggested_meta_description" text,
	"suggested_hook" text,
	"quick_hit_angle" text,
	"primary_video_angle" text,
	"story_angles" text[] DEFAULT '{}' NOT NULL,
	"visual_asset_suggestions" text[] DEFAULT '{}' NOT NULL,
	"media_rights_status" "media_rights_status" DEFAULT 'UNKNOWN_RIGHTS' NOT NULL,
	"assigned_to" uuid,
	"story_id" uuid,
	"is_test" boolean DEFAULT false NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_monitoring_enabled" boolean DEFAULT false NOT NULL,
	"automatic_drafting_enabled" boolean DEFAULT false NOT NULL,
	"deep_research_enabled" boolean DEFAULT false NOT NULL,
	"max_requests_per_day" integer DEFAULT 100 NOT NULL,
	"max_candidates_per_run" integer DEFAULT 20 NOT NULL,
	"max_ai_triage_calls_per_day" integer DEFAULT 0 NOT NULL,
	"max_ai_research_calls_per_day" integer DEFAULT 0 NOT NULL,
	"max_estimated_monthly_cost_cents" integer DEFAULT 0 NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_usage_daily" (
	"usage_date" text PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"response_bytes" integer DEFAULT 0 NOT NULL,
	"candidates_created" integer DEFAULT 0 NOT NULL,
	"ai_triage_calls" integer DEFAULT 0 NOT NULL,
	"ai_research_calls" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micros" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitored_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"authority_tier" "source_authority_tier" NOT NULL,
	"is_first_party" boolean DEFAULT false NOT NULL,
	"reliability_score" integer DEFAULT 50 NOT NULL,
	"historical_accuracy_notes" text,
	"connector_kind" "source_connector_kind" NOT NULL,
	"connector_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"health_status" "source_health_status" DEFAULT 'NOT_CHECKED' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_successful_fetch_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_http_status" integer,
	"last_error" text,
	"circuit_open_until" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"rate_limit_per_hour" integer DEFAULT 6 NOT NULL,
	"min_check_interval_minutes" integer DEFAULT 30 NOT NULL,
	"terms_policy_notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_fetch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "fetch_run_status" NOT NULL,
	"is_test_run" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"http_status" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"response_bytes" integer DEFAULT 0 NOT NULL,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"candidates_created" integer DEFAULT 0 NOT NULL,
	"duplicates_skipped" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"estimated_cost_micros" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"normalized_url" text NOT NULL,
	"title" text,
	"source_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"change_type" "source_change_type" DEFAULT 'UNKNOWN' NOT NULL,
	"meaningful_change" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"normalized_event_key" text NOT NULL,
	"primary_event" text NOT NULL,
	"primary_source_id" uuid,
	"status" "cluster_status" DEFAULT 'OPEN' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'SPECULATION' NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"community_reaction" text,
	"conflicting_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_evidence" ADD CONSTRAINT "candidate_evidence_candidate_id_discovery_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."discovery_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_evidence" ADD CONSTRAINT "candidate_evidence_source_id_monitored_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."monitored_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_evidence" ADD CONSTRAINT "candidate_evidence_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_alerts" ADD CONSTRAINT "discovery_alerts_candidate_id_discovery_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."discovery_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_alerts" ADD CONSTRAINT "discovery_alerts_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_alerts" ADD CONSTRAINT "discovery_alerts_source_id_monitored_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."monitored_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_alerts" ADD CONSTRAINT "discovery_alerts_acknowledged_by_editor_profiles_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_audit_logs" ADD CONSTRAINT "discovery_audit_logs_candidate_id_discovery_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."discovery_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_audit_logs" ADD CONSTRAINT "discovery_audit_logs_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_audit_logs" ADD CONSTRAINT "discovery_audit_logs_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_audit_logs" ADD CONSTRAINT "discovery_audit_logs_actor_id_editor_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_source_id_monitored_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."monitored_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_evergreen_page_id_evergreen_pages_id_fk" FOREIGN KEY ("evergreen_page_id") REFERENCES "public"."evergreen_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_assigned_to_editor_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_sources" ADD CONSTRAINT "monitored_sources_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_fetch_runs" ADD CONSTRAINT "source_fetch_runs_source_id_monitored_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."monitored_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_id_monitored_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."monitored_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_clusters" ADD CONSTRAINT "story_clusters_primary_source_id_monitored_sources_id_fk" FOREIGN KEY ("primary_source_id") REFERENCES "public"."monitored_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_clusters" ADD CONSTRAINT "story_clusters_created_by_editor_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_evidence_candidate_url_uidx" ON "candidate_evidence" USING btree ("candidate_id","source_url");--> statement-breakpoint
CREATE INDEX "candidate_evidence_candidate_idx" ON "candidate_evidence" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "discovery_alerts_status_priority_idx" ON "discovery_alerts" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "discovery_audit_candidate_date_idx" ON "discovery_audit_logs" USING btree ("candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "discovery_audit_action_idx" ON "discovery_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_candidates_source_version_uidx" ON "discovery_candidates" USING btree ("source_id","canonical_url","content_hash");--> statement-breakpoint
CREATE INDEX "discovery_candidates_status_priority_idx" ON "discovery_candidates" USING btree ("status","newsworthiness_score");--> statement-breakpoint
CREATE INDEX "discovery_candidates_cluster_idx" ON "discovery_candidates" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "discovery_candidates_source_date_idx" ON "discovery_candidates" USING btree ("source_id","discovered_at");--> statement-breakpoint
CREATE INDEX "discovery_candidates_seo_idx" ON "discovery_candidates" USING btree ("seo_opportunity_score");--> statement-breakpoint
CREATE INDEX "discovery_candidates_test_idx" ON "discovery_candidates" USING btree ("is_test");--> statement-breakpoint
CREATE INDEX "discovery_usage_updated_idx" ON "discovery_usage_daily" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_sources_url_uidx" ON "monitored_sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "monitored_sources_active_tier_idx" ON "monitored_sources" USING btree ("is_active","authority_tier");--> statement-breakpoint
CREATE INDEX "monitored_sources_health_idx" ON "monitored_sources" USING btree ("health_status");--> statement-breakpoint
CREATE INDEX "monitored_sources_next_check_idx" ON "monitored_sources" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "source_fetch_runs_source_date_idx" ON "source_fetch_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "source_fetch_runs_status_idx" ON "source_fetch_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "source_snapshots_source_content_uidx" ON "source_snapshots" USING btree ("source_id","content_hash");--> statement-breakpoint
CREATE INDEX "source_snapshots_checked_idx" ON "source_snapshots" USING btree ("checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_clusters_event_key_uidx" ON "story_clusters" USING btree ("normalized_event_key");--> statement-breakpoint
CREATE INDEX "story_clusters_status_seen_idx" ON "story_clusters" USING btree ("status","last_seen_at");
--> statement-breakpoint
ALTER TABLE public.monitored_sources
  ADD CONSTRAINT monitored_sources_reliability_score_check CHECK (reliability_score BETWEEN 0 AND 100),
  ADD CONSTRAINT monitored_sources_rate_limit_check CHECK (rate_limit_per_hour BETWEEN 1 AND 120),
  ADD CONSTRAINT monitored_sources_interval_check CHECK (min_check_interval_minutes BETWEEN 5 AND 10080);
ALTER TABLE public.discovery_candidates
  ADD CONSTRAINT discovery_candidates_confidence_check CHECK (confidence_score BETWEEN 0 AND 100),
  ADD CONSTRAINT discovery_candidates_newsworthiness_check CHECK (newsworthiness_score BETWEEN 0 AND 100),
  ADD CONSTRAINT discovery_candidates_seo_check CHECK (seo_opportunity_score BETWEEN 0 AND 100),
  ADD CONSTRAINT discovery_candidates_trend_check CHECK (trend_score BETWEEN 0 AND 100),
  ADD CONSTRAINT discovery_candidates_content_check CHECK (content_opportunity_score BETWEEN 0 AND 100),
  ADD CONSTRAINT discovery_candidates_quick_hit_check CHECK (quick_hit_score BETWEEN 0 AND 100),
  ADD CONSTRAINT discovery_candidates_primary_video_check CHECK (primary_video_score BETWEEN 0 AND 100),
  ADD CONSTRAINT discovery_candidates_promotion_check CHECK (
    (status = 'PROMOTED_TO_STORY' AND story_id IS NOT NULL)
    OR (status <> 'PROMOTED_TO_STORY' AND story_id IS NULL)
  );
ALTER TABLE public.story_clusters
  ADD CONSTRAINT story_clusters_confidence_check CHECK (confidence_score BETWEEN 0 AND 100);
ALTER TABLE public.candidate_evidence
  ADD CONSTRAINT candidate_evidence_authority_check CHECK (authority_score BETWEEN 0 AND 100);
ALTER TABLE public.discovery_alerts
  ADD CONSTRAINT discovery_alerts_priority_check CHECK (priority BETWEEN 0 AND 100);
ALTER TABLE public.discovery_settings
  ADD CONSTRAINT discovery_settings_limits_check CHECK (
    max_requests_per_day BETWEEN 0 AND 10000
    AND max_candidates_per_run BETWEEN 0 AND 500
    AND max_ai_triage_calls_per_day BETWEEN 0 AND 1000
    AND max_ai_research_calls_per_day BETWEEN 0 AND 500
    AND max_estimated_monthly_cost_cents BETWEEN 0 AND 100000
    AND retention_days BETWEEN 7 AND 365
  );
--> statement-breakpoint
CREATE TRIGGER monitored_sources_set_updated_at BEFORE UPDATE ON public.monitored_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER story_clusters_set_updated_at BEFORE UPDATE ON public.story_clusters
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER discovery_candidates_set_updated_at BEFORE UPDATE ON public.discovery_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER candidate_evidence_set_updated_at BEFORE UPDATE ON public.candidate_evidence
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER discovery_alerts_set_updated_at BEFORE UPDATE ON public.discovery_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER discovery_settings_set_updated_at BEFORE UPDATE ON public.discovery_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
CREATE TRIGGER discovery_usage_daily_set_updated_at BEFORE UPDATE ON public.discovery_usage_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_newsroom_updated_at();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.can_read_discovery_candidate(target_candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.editor_profiles profile
    JOIN public.discovery_candidates candidate ON candidate.id = target_candidate_id
    WHERE profile.auth_user_id = auth.uid()
      AND profile.is_active = true
      AND (
        profile.role IN ('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
        OR (
          profile.role = 'AUTHOR'
          AND (
            candidate.assigned_to = profile.id
            OR (
              candidate.story_id IS NOT NULL
              AND public.can_read_story(candidate.story_id)
            )
          )
        )
      )
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.can_read_story_cluster(target_cluster_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
    OR EXISTS (
      SELECT 1
      FROM public.discovery_candidates candidate
      WHERE candidate.cluster_id = target_cluster_id
        AND public.can_read_discovery_candidate(candidate.id)
    );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.can_read_discovery_candidate(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_story_cluster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_discovery_candidate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_story_cluster(uuid) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_discovery_candidate_api_fields()
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

  IF NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.source_url IS DISTINCT FROM OLD.source_url
    OR NEW.canonical_url IS DISTINCT FROM OLD.canonical_url
    OR NEW.source_hash IS DISTINCT FROM OLD.source_hash
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.discovered_at IS DISTINCT FROM OLD.discovered_at
    OR NEW.is_test IS DISTINCT FROM OLD.is_test
  THEN
    RAISE EXCEPTION 'Discovery provenance is immutable through the public API' USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'PROMOTED_TO_STORY' AND (
    NEW.story_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.stories story
      WHERE story.id = NEW.story_id
        AND story.status IN ('DISCOVERED', 'RESEARCHING', 'DRAFTING', 'NEEDS_REVIEW', 'FACT_CHECK')
        AND story.created_by = public.current_editor_profile_id()
        AND story.published_at IS NULL
        AND story.scheduled_for IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Candidates may only be promoted to a private draft created by the current editor' USING ERRCODE = '42501';
  END IF;

  IF actor_role = 'FACT_CHECKER' AND (
    to_jsonb(NEW) - ARRAY[
      'verification_recommendation', 'confidence_score', 'known_facts',
      'uncertainties', 'exact_quotes', 'conflicting_claims', 'community_questions', 'research_notes',
      'last_updated_at', 'updated_at'
    ]::text[]
    IS DISTINCT FROM
    to_jsonb(OLD) - ARRAY[
      'verification_recommendation', 'confidence_score', 'known_facts',
      'uncertainties', 'exact_quotes', 'conflicting_claims', 'community_questions', 'research_notes',
      'last_updated_at', 'updated_at'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'Fact checkers can only update evidence and verification fields' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_discovery_candidate_api_fields() FROM PUBLIC;
DROP TRIGGER IF EXISTS discovery_candidates_protect_api_fields ON public.discovery_candidates;
CREATE TRIGGER discovery_candidates_protect_api_fields
  BEFORE UPDATE ON public.discovery_candidates
  FOR EACH ROW EXECUTE FUNCTION public.protect_discovery_candidate_api_fields();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_candidate_evidence_api_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.source_url IS DISTINCT FROM OLD.source_url
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.author IS DISTINCT FROM OLD.author
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR NEW.authority_tier IS DISTINCT FROM OLD.authority_tier
    OR NEW.authority_score IS DISTINCT FROM OLD.authority_score
    OR NEW.is_primary IS DISTINCT FROM OLD.is_primary
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'Evidence provenance is immutable through the public API' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_candidate_evidence_api_fields() FROM PUBLIC;
CREATE TRIGGER candidate_evidence_protect_api_fields
  BEFORE UPDATE ON public.candidate_evidence
  FOR EACH ROW EXECUTE FUNCTION public.protect_candidate_evidence_api_fields();
--> statement-breakpoint
CREATE TRIGGER monitored_sources_protect_created_by
  BEFORE UPDATE ON public.monitored_sources
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_by_api_field();
CREATE TRIGGER story_clusters_protect_created_by
  BEFORE UPDATE ON public.story_clusters
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_by_api_field();
CREATE TRIGGER candidate_evidence_protect_created_by
  BEFORE UPDATE ON public.candidate_evidence
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_by_api_field();
--> statement-breakpoint
ALTER TABLE public.monitored_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_fetch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_usage_daily ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "members read monitored sources" ON public.monitored_sources
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "admins insert monitored sources" ON public.monitored_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN')
    AND created_by = public.current_editor_profile_id()
    AND is_active = false
  );
CREATE POLICY "admins update monitored sources" ON public.monitored_sources
  FOR UPDATE TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN'));
CREATE POLICY "admins delete monitored sources" ON public.monitored_sources
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "reviewers read fetch runs" ON public.source_fetch_runs
  FOR SELECT TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER'));
CREATE POLICY "reviewers read source snapshots" ON public.source_snapshots
  FOR SELECT TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER'));

CREATE POLICY "role scoped cluster reads" ON public.story_clusters
  FOR SELECT TO authenticated USING (public.can_read_story_cluster(id));
CREATE POLICY "editors insert story clusters" ON public.story_clusters
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND created_by = public.current_editor_profile_id()
  );
CREATE POLICY "editors update story clusters" ON public.story_clusters
  FOR UPDATE TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete story clusters" ON public.story_clusters
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "role scoped candidate reads" ON public.discovery_candidates
  FOR SELECT TO authenticated USING (public.can_read_discovery_candidate(id));
CREATE POLICY "editors insert candidates" ON public.discovery_candidates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR')
    AND created_by = public.current_editor_profile_id()
    AND status IN ('DISCOVERED', 'TRIAGED', 'RESEARCHING')
    AND story_id IS NULL
  );
CREATE POLICY "editors update candidates" ON public.discovery_candidates
  FOR UPDATE TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "fact checkers update candidate evidence" ON public.discovery_candidates
  FOR UPDATE TO authenticated
  USING (
    public.has_newsroom_role('FACT_CHECKER')
    AND public.can_read_discovery_candidate(id)
  )
  WITH CHECK (
    public.has_newsroom_role('FACT_CHECKER')
    AND public.can_read_discovery_candidate(id)
  );
CREATE POLICY "admins delete candidates" ON public.discovery_candidates
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "role scoped evidence reads" ON public.candidate_evidence
  FOR SELECT TO authenticated USING (public.can_read_discovery_candidate(candidate_id));
CREATE POLICY "assigned newsroom members add evidence" ON public.candidate_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_read_discovery_candidate(candidate_id)
    AND created_by = public.current_editor_profile_id()
    AND source_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.monitored_sources source
      WHERE source.id = candidate_evidence.source_id
        AND candidate_evidence.authority_tier = source.authority_tier
        AND candidate_evidence.authority_score = source.reliability_score
        AND (
          lower(substring(candidate_evidence.source_url from '^https://([^/:?#]+)')) = lower(source.domain)
          OR right(
            lower(substring(candidate_evidence.source_url from '^https://([^/:?#]+)')),
            length(source.domain) + 1
          ) = '.' || lower(source.domain)
        )
    )
  );
CREATE POLICY "reviewers update evidence" ON public.candidate_evidence
  FOR UPDATE TO authenticated
  USING (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
    AND public.can_read_discovery_candidate(candidate_id)
  )
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
    AND public.can_read_discovery_candidate(candidate_id)
  );
CREATE POLICY "editors delete evidence" ON public.candidate_evidence
  FOR DELETE TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));

CREATE POLICY "reviewers read discovery alerts" ON public.discovery_alerts
  FOR SELECT TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER'));
CREATE POLICY "editors insert discovery alerts" ON public.discovery_alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "editors update discovery alerts" ON public.discovery_alerts
  FOR UPDATE TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins delete discovery alerts" ON public.discovery_alerts
  FOR DELETE TO authenticated USING (public.has_newsroom_role('OWNER', 'ADMIN'));

CREATE POLICY "reviewers read discovery audit" ON public.discovery_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER'));
CREATE POLICY "reviewers append attributed discovery audit" ON public.discovery_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR', 'FACT_CHECKER')
    AND actor_type = 'MANUAL'
    AND actor_id = public.current_editor_profile_id()
    AND (candidate_id IS NULL OR public.can_read_discovery_candidate(candidate_id))
    AND (cluster_id IS NULL OR public.can_read_story_cluster(cluster_id))
    AND (story_id IS NULL OR public.can_read_story(story_id))
  );

CREATE POLICY "editors read discovery settings" ON public.discovery_settings
  FOR SELECT TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
CREATE POLICY "admins update discovery settings" ON public.discovery_settings
  FOR UPDATE TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN'))
  WITH CHECK (public.has_newsroom_role('OWNER', 'ADMIN'));
CREATE POLICY "editors read discovery usage" ON public.discovery_usage_daily
  FOR SELECT TO authenticated
  USING (public.has_newsroom_role('OWNER', 'ADMIN', 'EDITOR'));
--> statement-breakpoint
REVOKE ALL ON
  public.monitored_sources,
  public.source_fetch_runs,
  public.source_snapshots,
  public.story_clusters,
  public.discovery_candidates,
  public.candidate_evidence,
  public.discovery_alerts,
  public.discovery_audit_logs,
  public.discovery_settings,
  public.discovery_usage_daily
FROM anon;
REVOKE ALL ON
  public.monitored_sources,
  public.source_fetch_runs,
  public.source_snapshots,
  public.story_clusters,
  public.discovery_candidates,
  public.candidate_evidence,
  public.discovery_alerts,
  public.discovery_audit_logs,
  public.discovery_settings,
  public.discovery_usage_daily
FROM authenticated;

GRANT SELECT ON
  public.monitored_sources,
  public.source_fetch_runs,
  public.source_snapshots,
  public.story_clusters,
  public.discovery_candidates,
  public.candidate_evidence,
  public.discovery_alerts,
  public.discovery_audit_logs,
  public.discovery_settings,
  public.discovery_usage_daily
TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.monitored_sources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.story_clusters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.discovery_candidates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.candidate_evidence TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.discovery_alerts TO authenticated;
GRANT INSERT ON public.discovery_audit_logs TO authenticated;
GRANT UPDATE ON public.discovery_settings TO authenticated;
--> statement-breakpoint
INSERT INTO public.discovery_settings (
  id,
  recurring_monitoring_enabled,
  automatic_drafting_enabled,
  deep_research_enabled,
  max_requests_per_day,
  max_candidates_per_run,
  max_ai_triage_calls_per_day,
  max_ai_research_calls_per_day,
  max_estimated_monthly_cost_cents,
  retention_days
) VALUES (
  '40000000-0000-4000-8000-000000000001',
  false,
  false,
  false,
  100,
  20,
  0,
  0,
  0,
  30
) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.monitored_sources (
  id,
  name,
  url,
  domain,
  source_type,
  authority_tier,
  is_first_party,
  reliability_score,
  historical_accuracy_notes,
  connector_kind,
  connector_config,
  is_active,
  rate_limit_per_hour,
  min_check_interval_minutes,
  terms_policy_notes
) VALUES
  (
    '41000000-0000-4000-8000-000000000001',
    'Rockstar Games Newswire — GTA VI',
    'https://www.rockstargames.com/newswire?tag_id=722',
    'rockstargames.com',
    'FIRST_PARTY',
    'TIER_1',
    true,
    100,
    'Official Rockstar announcements. Exact wording must still be preserved and checked.',
    'HTML_LISTING',
    '{"linkPrefixes":["/newswire/article/"],"maxItems":20}'::jsonb,
    false,
    4,
    30,
    'Public announcement listing only. Respect Rockstar terms and robots directives. Do not download media or game assets.'
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    'Official Grand Theft Auto VI page',
    'https://www.rockstargames.com/VI',
    'rockstargames.com',
    'FIRST_PARTY',
    'TIER_1',
    true,
    100,
    'Official GTA VI product and release-information page.',
    'HTML_CHANGE',
    '{"meaningfulSections":["release","platforms","preorder","trailers","screenshots"]}'::jsonb,
    false,
    2,
    60,
    'Hash normalized public text only. Ignore styling, tracking, and cookie-banner changes. Do not download listed assets.'
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    'Official GTA VI videos and media page',
    'https://www.rockstargames.com/VI/downloads/videos',
    'rockstargames.com',
    'FIRST_PARTY',
    'TIER_1',
    true,
    100,
    'Official Rockstar video and artwork listing.',
    'HTML_CHANGE',
    '{"meaningfulSections":["videos","screenshots","artwork"]}'::jsonb,
    false,
    2,
    120,
    'Detect metadata changes only. Never bulk-download, mirror, or ingest the linked media files.'
  ),
  (
    '41000000-0000-4000-8000-000000000004',
    'Take-Two Interactive press releases',
    'https://www.take2games.com/ir/press-releases',
    'take2games.com',
    'PRESS_RELEASE',
    'TIER_1',
    true,
    100,
    'Official parent-company press releases and financial announcements.',
    'HTML_LISTING',
    '{"linkPrefixes":["/ir/news/","/ir/press-releases/news-release-details/"],"includeTerms":["grand theft auto vi","gta vi","gta 6"],"maxItems":25}'::jsonb,
    false,
    4,
    60,
    'Public investor-relations listing only. Preserve forward-looking-statement context and original dates.'
  ),
  (
    '41000000-0000-4000-8000-000000000005',
    'VGC — Video Games Chronicle',
    'https://www.videogameschronicle.com/',
    'videogameschronicle.com',
    'JOURNALISM',
    'TIER_2',
    false,
    84,
    'Established gaming publication. Trace exclusives and quoted claims to their original sources when possible.',
    'HTML_LISTING',
    '{"linkPrefixes":["/news/"],"includeTerms":["grand theft auto vi","gta vi","gta 6"],"maxItems":20}'::jsonb,
    false,
    2,
    180,
    'Store metadata, short facts, and links only. Do not copy full articles or automatically download media.'
  ),
  (
    '41000000-0000-4000-8000-000000000006',
    'GameSpot — Grand Theft Auto VI',
    'https://www.gamespot.com/games/grand-theft-auto-vi/',
    'gamespot.com',
    'JOURNALISM',
    'TIER_2',
    false,
    82,
    'Established gaming publication and GTA VI topic page.',
    'HTML_LISTING',
    '{"linkPrefixes":["/articles/","/gallery/","/videos/"],"maxItems":20}'::jsonb,
    false,
    2,
    180,
    'Store metadata, short facts, and links only. Avoid affiliate or commerce-only items during triage.'
  ),
  (
    '41000000-0000-4000-8000-000000000007',
    'IGN — Grand Theft Auto VI',
    'https://www.ign.com/games/grand-theft-auto-vi',
    'ign.com',
    'JOURNALISM',
    'TIER_2',
    false,
    82,
    'Established gaming publication. Connector remains manual until a permitted stable feed or listing is validated.',
    'MANUAL',
    '{}'::jsonb,
    false,
    1,
    360,
    'Manual discovery only. Do not bypass access controls or robots restrictions.'
  ),
  (
    '41000000-0000-4000-8000-000000000008',
    'Reddit r/GTA6 community discovery',
    'https://www.reddit.com/r/GTA6/',
    'reddit.com',
    'COMMUNITY_DISCOVERY',
    'TIER_3',
    false,
    35,
    'Community discussion is a discovery signal, not evidence of fact.',
    'MANUAL',
    '{}'::jsonb,
    false,
    1,
    720,
    'Public community only. No private-community access, user profiling, doxxed information, or automated claim confirmation.'
  )
ON CONFLICT (id) DO NOTHING;
