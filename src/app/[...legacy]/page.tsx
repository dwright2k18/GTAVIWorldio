import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { getEditorialRedirect } from "@/lib/cms/public-queries";

export const metadata: Metadata = {
  title: "Page Not Found",
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default async function LegacyRedirectPage({ params }: { params: Promise<{ legacy: string[] }> }) {
  const path = `/${(await params).legacy.join('/')}`.toLowerCase();
  const redirect = await getEditorialRedirect(path);
  if (redirect) permanentRedirect(redirect.newPath);
  notFound();
}
