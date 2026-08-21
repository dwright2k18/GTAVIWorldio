import { siteFeatures } from "@/lib/site";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Latest", href: "/latest" },
  { label: "News", href: "/news" },
  { label: "Videos", href: "/quick-hits#all-clips" },
  { label: "Quick Hits", href: "/quick-hits" },
  { label: "Map", href: "/map" },
  { label: "Characters", href: "/characters" },
  { label: "Gameplay", href: "/gameplay" },
  { label: "Rumors", href: "/rumors" },
  { label: "Guides", href: "/release-date" },
  { label: "Verification", href: "/verification" },
] as const;

const quickHitLabels = new Set(["Videos", "Quick Hits"]);

export const primaryNavigation = navigationItems.filter(
  (item) => siteFeatures.quickHits || !quickHitLabels.has(item.label),
);

export const desktopNavigation = primaryNavigation.filter((item) =>
  ["Latest", "News", "Videos", "Quick Hits", "Map", "Characters", "Rumors"].includes(
    item.label,
  ),
);

export const footerNavigation = {
  Explore: primaryNavigation.filter((item) =>
    ["Latest", "News", "Videos", "Quick Hits", "Map"].includes(item.label),
  ),
  Knowledge: [
    { label: "Release date", href: "/release-date" },
    { label: "Lucia", href: "/characters/lucia" },
    { label: "Jason", href: "/characters/jason" },
    { label: "Trailers", href: "/trailers" },
    { label: "Online", href: "/online" },
  ],
  Standards: [
    { label: "Verification", href: "/verification" },
    { label: "Editorial policy", href: "/editorial-policy" },
    { label: "Corrections", href: "/corrections" },
  ],
  Publication: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
} as const;
