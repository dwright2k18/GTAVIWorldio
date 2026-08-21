import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How GTA VI World handles data on its pre-launch website.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "GTA VI World Privacy Policy",
    description: "How GTA VI World handles data on its pre-launch website.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Your data"
      title="Privacy Policy"
      introduction={
        <p>
          GTA VI World is currently a pre-launch publication. We minimize data collection and will update this policy before activating any newsletter, analytics, advertising, account, or submission service.
        </p>
      }
      sections={[
        {
          title: "Information you provide",
          content: (
            <p>
              The current website does not create user accounts, accept comments, receive file uploads, or store newsletter addresses. The newsletter area is an inactive interface and clearly states that signup is not open.
            </p>
          ),
        },
        {
          title: "Technical information",
          content: (
            <p>
              Our hosting and security providers may process ordinary request data such as IP address, browser type, device information, timestamps, and requested pages to deliver and protect the site. No audience analytics provider is connected by the application at this stage.
            </p>
          ),
        },
        {
          title: "Cookies and analytics",
          content: (
            <p>
              GTA VI World does not currently set application analytics or advertising cookies. If measurement tools are introduced, we will document the provider, purpose, retention, choices, and any consent controls before collection begins.
            </p>
          ),
        },
        {
          title: "External links and changes",
          content: (
            <p>
              Links to other websites are governed by those sites&apos; policies. We may revise this policy as services are added; the date above will identify the current version, and material changes will be explained before they take effect.
            </p>
          ),
        },
      ]}
    />
  );
}
