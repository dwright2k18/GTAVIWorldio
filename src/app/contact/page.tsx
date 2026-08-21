import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact information and submission guidance for GTA VI World.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact GTA VI World",
    description: "Contact information and submission guidance for GTA VI World.",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <PolicyPage
      eyebrow="Contact the newsroom"
      title="Contact"
      introduction={
        <p>
          A public newsroom contact channel will be published here before launch. This staging page does not collect messages, email addresses, files, or tips.
        </p>
      }
      sections={[
        {
          title: "Corrections",
          content: (
            <p>
              Our correction standards are available now. Review the <Link href="/corrections">corrections policy</Link> for what to include when the public contact channel opens.
            </p>
          ),
        },
        {
          title: "Tips and source material",
          content: (
            <p>
              Do not send passwords, private account access, stolen data, doxxing material, or files obtained through unlawful access. We will publish a secure, monitored route for legitimate tips only after its privacy and security controls are ready.
            </p>
          ),
        },
        {
          title: "Rights and permissions",
          content: (
            <p>
              A dedicated route for copyright, licensing, and attribution requests will be included with the public contact channel. Until then, no material should be submitted through this site.
            </p>
          ),
        },
      ]}
    />
  );
}
