export const primaryNavigation = [
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
] as const;

export const footerNavigation = {
  Explore: primaryNavigation.slice(1, 6),
  Knowledge: [
    { label: "Release date", href: "/search?q=release+date" },
    { label: "Lucia", href: "/search?q=Lucia" },
    { label: "Jason", href: "/search?q=Jason" },
    { label: "Vice City", href: "/search?q=Vice+City" },
    { label: "Platforms", href: "/search?q=platforms" },
  ],
} as const;
