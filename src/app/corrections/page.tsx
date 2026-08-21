import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/policy-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Corrections Policy",
  description: "How GTA VI World receives, reviews, and discloses editorial corrections.",
  alternates: { canonical: "/corrections" },
  openGraph: {
    title: "GTA VI World Corrections Policy",
    description: "How GTA VI World receives, reviews, and discloses editorial corrections.",
    url: "/corrections",
  },
};

export default function CorrectionsPage() {
  return (
    <PolicyPage
      eyebrow="Accuracy in public"
      title="Corrections Policy"
      introduction={
        <p>
          Accuracy is a continuing obligation. When a factual error is confirmed, GTA VI World corrects the record clearly and as quickly as practical.
        </p>
      }
      sections={[
        {
          title: "What we correct",
          content: (
            <p>
              We review challenges to names, dates, quotations, sourcing, context, media attribution, verification status, and any other factual claim. New information may be handled as an update; inaccurate information is handled as a correction.
            </p>
          ),
        },
        {
          title: "How corrections appear",
          content: (
            <p>
              Material corrections receive a visible note explaining what changed, and the article&apos;s update time is revised. Minor spelling, grammar, or formatting fixes may be made without a note when they do not alter meaning. We do not erase a valid correction because a story has moved out of the news cycle.
            </p>
          ),
        },
        {
          title: "How to request a review",
          content: (
            <p>
              {siteConfig.contactEmail ? (
                <>
                  Send correction requests to <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. A useful request identifies the page, the precise statement at issue, the proposed correction, and supporting primary evidence.
                </>
              ) : (
                <>
                  Before public launch, a monitored correction address will be added to the <Link href="/contact">contact page</Link>. A useful request identifies the page, the precise statement at issue, the proposed correction, and supporting primary evidence. This staging site does not currently collect submissions.
                </>
              )}
            </p>
          ),
        },
      ]}
    />
  );
}
