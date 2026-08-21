"use client";

import { useEffect } from "react";
import {
  trackEvent,
  type AnalyticsEventData,
  type AnalyticsEventName,
} from "@/lib/analytics";

export function AnalyticsEvent({
  name,
  data,
}: {
  name: AnalyticsEventName;
  data?: AnalyticsEventData;
}) {
  useEffect(() => {
    trackEvent(name, data);
  }, [name, data]);

  return null;
}
