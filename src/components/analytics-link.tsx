"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import {
  trackEvent,
  type AnalyticsEventData,
  type AnalyticsEventName,
} from "@/lib/analytics";

type AnalyticsLinkProps = ComponentProps<typeof Link> & {
  eventName: AnalyticsEventName;
  eventData?: AnalyticsEventData;
};

export function AnalyticsLink({
  eventName,
  eventData,
  onClick,
  ...props
}: AnalyticsLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackEvent(eventName, eventData);
        onClick?.(event);
      }}
    />
  );
}
