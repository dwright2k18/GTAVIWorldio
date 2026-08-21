import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "About",
  description: "About GTA VI World, an independent fan publication focused on sourced GTA VI news and analysis.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About GTA VI World",
    description: "Meet the independent fan publication focused on sourced GTA VI news and analysis.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <PolicyPage
      eyebrow="Independent by design"
      title="About GTA VI World"
      introduction={
        <p>
          GTA VI World is an independent fan publication built to make fast-moving GTA VI coverage easier to understand, verify, and explore.
        </p>
      }
      sections={[
        {
          title: "Our mission",
          content: (
            <p>
              We organize official updates, responsible reporting, analysis, and community conversation without blurring the line between them. Every story carries a visible evidence label and a source trail wherever one is available.
            </p>
          ),
        },
        {
          title: "Our independence",
          content: (
            <p>
              GTA VI World is not owned, operated, sponsored, endorsed, or affiliated with Rockstar Games or Take-Two Interactive. Grand Theft Auto, GTA, GTA VI, Rockstar Games, Take-Two Interactive, and related names and marks belong to their respective owners.
            </p>
          ),
        },
        {
          title: "How we work",
          content: (
            <p>
              Read our <Link href="/verification">verification standard</Link>, <Link href="/editorial-policy">editorial policy</Link>, and <Link href="/corrections">corrections policy</Link> for the rules behind our coverage.
            </p>
          ),
        },
      ]}
    />
  );
}
