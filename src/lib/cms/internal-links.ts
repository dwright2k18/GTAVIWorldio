const hubRules = [
  { pattern: /\blucia\b/i, label: "Lucia character guide", href: "/characters/lucia" },
  { pattern: /\bjason\b/i, label: "Jason character guide", href: "/characters/jason" },
  { pattern: /\b(vice city|leonida|map|location)\b/i, label: "GTA VI map guide", href: "/map" },
  { pattern: /\btrailer(s)?\b/i, label: "GTA VI trailers", href: "/trailers" },
  { pattern: /\brelease date|release timing|launch window\b/i, label: "GTA VI release date", href: "/release-date" },
  { pattern: /\bgameplay|mechanic(s)?\b/i, label: "GTA VI gameplay", href: "/gameplay" },
  { pattern: /\bvehicle(s)?|car(s)?\b/i, label: "GTA VI vehicles", href: "/vehicles" },
  { pattern: /\bonline|multiplayer\b/i, label: "GTA VI Online", href: "/online" },
] as const;

export function suggestHubLinks(text: string, limit = 4) {
  return hubRules
    .filter((rule) => rule.pattern.test(text))
    .slice(0, Math.max(0, limit))
    .map(({ label, href }) => ({ label, href }));
}
