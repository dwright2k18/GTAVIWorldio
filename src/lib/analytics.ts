export const analyticsEvents = [
  "article_view",
  "search_use",
  "quick_hit_play",
  "related_story_click",
  "social_outbound_click",
  "newsletter_signup_intent",
  "share_action",
] as const;

export type AnalyticsEventName = (typeof analyticsEvents)[number];
export type AnalyticsEventData = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Provider-neutral event boundary. It emits an in-page event only; no analytics
 * service, cookie, request, or persistent identifier is connected here.
 */
export function trackEvent(name: AnalyticsEventName, data: AnalyticsEventData = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("gtaviworld:analytics", {
      detail: { name, data },
    }),
  );
}
