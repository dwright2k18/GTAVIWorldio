ALTER TABLE public.monitored_sources
  ADD COLUMN IF NOT EXISTS last_successful_extraction_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_discovered_item_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_extraction_method text,
  ADD COLUMN IF NOT EXISTS last_content_hash text;
--> statement-breakpoint
UPDATE public.monitored_sources
SET
  connector_config = '{"linkPrefixes":["/newswire/article/"],"includeTerms":["grand theft auto vi","gta vi","gta 6"],"maxItems":20,"maxDetailItems":4,"clientRenderedListing":true,"requireItems":true,"detailUrls":["https://www.rockstargames.com/newswire/article/9k2kaa1o3297k9/grand-theft-auto-vi-an-extended-look"]}'::jsonb,
  rate_limit_per_hour = 4,
  min_check_interval_minutes = 60,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000001';
--> statement-breakpoint
UPDATE public.monitored_sources
SET
  connector_config = '{"linkPrefixes":["/ir/news/","/ir/press-releases/news-release-details/"],"includeTerms":["grand theft auto vi","gta vi","gta 6"],"maxItems":25,"maxDetailItems":5,"followDetails":true,"requireItems":true,"ignoredDescriptionFragments":["Investor Relations website contains information"]}'::jsonb,
  rate_limit_per_hour = 4,
  min_check_interval_minutes = 120,
  updated_at = now()
WHERE id = '41000000-0000-4000-8000-000000000004';
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
) VALUES (
  '41000000-0000-4000-8000-000000000009',
  'Rockstar Games official YouTube feed',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC6VcWc1rAoWdBCM0JxrRQ3A',
  'youtube.com',
  'FIRST_PARTY',
  'TIER_1',
  true,
  100,
  'Official Rockstar Games channel. The feed is a first-party secondary discovery signal for public video announcements.',
  'ATOM',
  '{"includeTerms":["grand theft auto vi","gta vi","gta 6"],"maxItems":20,"requireItems":true}'::jsonb,
  false,
  2,
  120,
  'Use the public Atom feed only. Store video metadata and links; do not download or mirror video or thumbnail assets.'
)
ON CONFLICT (id) DO UPDATE SET
  connector_config = EXCLUDED.connector_config,
  is_active = false,
  rate_limit_per_hour = EXCLUDED.rate_limit_per_hour,
  min_check_interval_minutes = EXCLUDED.min_check_interval_minutes,
  terms_policy_notes = EXCLUDED.terms_policy_notes,
  updated_at = now();
