import { siteFeatures } from "@/lib/site";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Latest", href: "/latest" },
  { label: "News", href: "/latest?category=Official" },
  { label: "Videos", href: "/quick-hits#all-clips" },
  { label: "Quick Hits", href: "/quick-hits" },
  { label: "Map", href: "/search?q=map" },
  { label: "Characters", href: "/search?q=characters" },
  { label: "Gameplay", href: "/search?q=gameplay" },
  { label: "Rumors", href: "/latest?verification=RUMOR" },
  { label: "Guides", href: "/search?q=guide" },
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
    { label: "Release date", href: "/search?q=release+date" },
    { label: "Lucia", href: "/search?q=Lucia" },
    { label: "Jason", href: "/search?q=Jason" },
    { label: "Vice City", href: "/search?q=Vice+City" },
    { label: "Platforms", href: "/search?q=platforms" },
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
