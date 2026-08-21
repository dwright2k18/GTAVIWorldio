CREATE TABLE "evergreen_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evergreen_page_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"editor_id" uuid,
	"fields_changed" text[] DEFAULT '{}' NOT NULL,
	"previous_content" jsonb NOT NULL,
	"new_content" jsonb NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evergreen_sources" (
	"evergreen_page_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"evidence_notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "evergreen_sources_evergreen_page_id_source_id_pk" PRIMARY KEY("evergreen_page_id","source_id")
);
--> statement-breakpoint
ALTER TABLE "evergreen_revisions" ADD CONSTRAINT "evergreen_revisions_evergreen_page_id_evergreen_pages_id_fk" FOREIGN KEY ("evergreen_page_id") REFERENCES "public"."evergreen_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evergreen_revisions" ADD CONSTRAINT "evergreen_revisions_editor_id_editor_profiles_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."editor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evergreen_sources" ADD CONSTRAINT "evergreen_sources_evergreen_page_id_evergreen_pages_id_fk" FOREIGN KEY ("evergreen_page_id") REFERENCES "public"."evergreen_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evergreen_sources" ADD CONSTRAINT "evergreen_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evergreen_revisions_number_uidx" ON "evergreen_revisions" USING btree ("evergreen_page_id","revision_number");--> statement-breakpoint
CREATE INDEX "evergreen_revisions_page_date_idx" ON "evergreen_revisions" USING btree ("evergreen_page_id","created_at");--> statement-breakpoint
CREATE INDEX "evergreen_sources_source_idx" ON "evergreen_sources" USING btree ("source_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.log_evergreen_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_fields text[];
  editor_profile_id uuid;
  revision_reason text;
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

  editor_profile_id := nullif(current_setting('app.editor_profile_id', true), '')::uuid;
  revision_reason := nullif(current_setting('app.revision_reason', true), '');

  INSERT INTO public.evergreen_revisions (
    evergreen_page_id,
    revision_number,
    editor_id,
    fields_changed,
    previous_content,
    new_content,
    change_reason
  ) VALUES (
    NEW.id,
    coalesce((SELECT max(revision_number) + 1 FROM public.evergreen_revisions WHERE evergreen_page_id = NEW.id), 1),
    editor_profile_id,
    changed_fields,
    to_jsonb(OLD),
    to_jsonb(NEW),
    revision_reason
  );

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER evergreen_pages_revision_log
  AFTER UPDATE ON public.evergreen_pages
  FOR EACH ROW EXECUTE FUNCTION public.log_evergreen_revision();
--> statement-breakpoint
ALTER TABLE public.evergreen_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evergreen_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsroom members read evergreen revisions" ON public.evergreen_revisions
  FOR SELECT TO authenticated USING (public.is_newsroom_member());
CREATE POLICY "newsroom members create evergreen revisions" ON public.evergreen_revisions
  FOR INSERT TO authenticated WITH CHECK (public.is_newsroom_member());
CREATE POLICY "newsroom members manage evergreen sources" ON public.evergreen_sources
  FOR ALL TO authenticated USING (public.is_newsroom_member()) WITH CHECK (public.is_newsroom_member());
REVOKE ALL ON public.evergreen_revisions, public.evergreen_sources FROM anon;
GRANT SELECT, INSERT ON public.evergreen_revisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evergreen_sources TO authenticated;
