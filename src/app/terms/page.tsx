import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms governing use of the GTA VI World website.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "GTA VI World Terms of Use",
    description: "Terms governing use of the GTA VI World website.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Site terms"
      title="Terms of Use"
      introduction={
        <p>
          These terms describe the conditions for using GTA VI World. By using the site, you agree to use it lawfully and to respect the rights of the publication and third parties.
        </p>
      }
      sections={[
        {
          title: "Independent publication",
          content: (
            <p>
              GTA VI World is an independent fan publication and is not owned, operated, sponsored, endorsed, or affiliated with Rockstar Games or Take-Two Interactive. Grand Theft Auto, GTA, GTA VI, Rockstar Games, Take-Two Interactive, and related names and marks belong to their respective owners.
            </p>
          ),
        },
        {
          title: "Editorial information",
          content: (
            <p>
              Coverage is provided for news, commentary, criticism, and informational purposes. Verification labels communicate our assessment of sourcing at publication time; they do not guarantee that every developing claim will remain unchanged.
            </p>
          ),
        },
        {
          title: "Copyright and acceptable use",
          content: (
            <p>
              Original writing, graphics, branding, and site design may not be republished or commercially exploited without permission. You may link to public pages and make limited lawful use of excerpts with clear attribution. Do not interfere with the site, bypass security, scrape it abusively, or submit unlawful material.
            </p>
          ),
        },
        {
          title: "External services and availability",
          content: (
            <p>
              Third-party links and embeds are controlled by their providers. We may correct, update, suspend, or remove site material when necessary. To the extent permitted by law, the site is provided without a promise of uninterrupted availability or suitability for a particular purpose.
            </p>
          ),
        },
      ]}
    />
  );
}
