import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Editorial Policy",
  description: "The sourcing, verification, correction, AI, copyright, and community standards used by GTA VI World.",
  alternates: { canonical: "/editorial-policy" },
  openGraph: {
    title: "GTA VI World Editorial Policy",
    description: "The sourcing, verification, correction, AI, copyright, and community standards used by GTA VI World.",
    url: "/editorial-policy",
  },
};

export default function EditorialPolicyPage() {
  return (
    <PolicyPage
      eyebrow="How coverage is made"
      title="Editorial Policy"
      introduction={
        <p>
          Our job is to make the evidence visible. These standards govern every article, update, Quick Hit, headline, thumbnail, and social post published by GTA VI World.
        </p>
      }
      sections={[
        {
          title: "Verification labels",
          content: (
            <p>
              We use five statuses: <strong>CONFIRMED</strong>, <strong>CREDIBLE REPORT</strong>, <strong>RUMOR</strong>, <strong>SPECULATION</strong>, and <strong>ALLEGED LEAK</strong>. A label may change when the evidence changes. The complete definitions are on our <Link href="/verification">verification page</Link>.
            </p>
          ),
        },
        {
          title: "Sources, attribution, and anonymous sources",
          content: (
            <p>
              Primary sources lead confirmed coverage. Secondary reporting is linked and attributed close to the claim it supports. Anonymous sourcing requires a clear public-interest reason, independent corroboration whenever possible, and editorial review of the source&apos;s access and motives. Anonymity is not used to turn unsupported chatter into news.
            </p>
          ),
        },
        {
          title: "Corrections and updates",
          content: (
            <p>
              We correct factual errors promptly, preserve publication and update dates, and add a visible note when a material correction changes a reader&apos;s understanding. Silent edits are limited to spelling, grammar, formatting, or similarly immaterial fixes. See the <Link href="/corrections">corrections policy</Link>.
            </p>
          ),
        },
        {
          title: "AI-assisted work",
          content: (
            <p>
              AI tools may assist with research organization, transcription, translation, data processing, or drafting, but they are not treated as sources. A human editor remains responsible for checking claims, citations, rights, tone, and final publication. We do not fabricate quotations, eyewitness accounts, sources, screenshots, or evidence.
            </p>
          ),
        },
        {
          title: "Copyright, leaks, and sensitive material",
          content: (
            <p>
              We use approved assets, original graphics, licensed material, embeds, or limited excerpts only when there is a defensible editorial purpose. We do not host stolen game builds, source code, credentials, doxxing material, or instructions that facilitate unlawful access. Alleged leaks require heightened verification, careful minimization, and an assessment of privacy, safety, copyright, and public interest before publication.
            </p>
          ),
        },
        {
          title: "User-generated content",
          content: (
            <p>
              Community material is verified and credited before editorial use. Submission does not establish ownership or authenticity. We seek permission where required, avoid exposing private individuals, and remove or correct material when a substantiated rights, safety, or attribution problem is identified.
            </p>
          ),
        },
      ]}
    />
  );
}
