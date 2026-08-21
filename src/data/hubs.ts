export type HubKey =
  | "release-date"
  | "map"
  | "characters"
  | "lucia"
  | "jason"
  | "gameplay"
  | "trailers"
  | "vehicles"
  | "online"
  | "rumors";

export const hubs: Record<HubKey, {
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  searchIntent: string;
  related: Array<{ label: string; href: string }>;
}> = {
  "release-date": { path: "/release-date", title: "GTA VI Release Date", eyebrow: "Living release guide", description: "A maintained home for official GTA VI release timing, meaningful changes, and clearly sourced context.", searchIntent: "Get the latest confirmed GTA VI release-date information without mixing official statements with rumor.", related: [{ label: "Latest news", href: "/news" }, { label: "Rockstar coverage", href: "/latest?category=Official" }, { label: "Verification standard", href: "/verification" }] },
  map: { path: "/map", title: "GTA VI Map", eyebrow: "World intelligence", description: "An evidence-led guide to GTA VI locations, map information, and the line between visible detail and theory.", searchIntent: "Understand what approved sources establish about the GTA VI map and locations.", related: [{ label: "Characters", href: "/characters" }, { label: "Gameplay", href: "/gameplay" }, { label: "Latest news", href: "/news" }] },
  characters: { path: "/characters", title: "GTA VI Characters", eyebrow: "Character directory", description: "A central guide to GTA VI characters built from approved first-party material and clearly labeled reporting.", searchIntent: "Find comprehensive, sourced information about confirmed GTA VI characters.", related: [{ label: "Lucia", href: "/characters/lucia" }, { label: "Jason", href: "/characters/jason" }, { label: "Latest news", href: "/news" }] },
  lucia: { path: "/characters/lucia", title: "Lucia in GTA VI", eyebrow: "Character guide", description: "A maintained Lucia reference that will separate official character information from analysis and fan interpretation.", searchIntent: "Find comprehensive, source-backed information about Lucia in GTA VI.", related: [{ label: "All characters", href: "/characters" }, { label: "Jason", href: "/characters/jason" }, { label: "Trailers", href: "/trailers" }] },
  jason: { path: "/characters/jason", title: "Jason in GTA VI", eyebrow: "Character guide", description: "A maintained Jason reference that will separate official character information from analysis and fan interpretation.", searchIntent: "Find comprehensive, source-backed information about Jason in GTA VI.", related: [{ label: "All characters", href: "/characters" }, { label: "Lucia", href: "/characters/lucia" }, { label: "Trailers", href: "/trailers" }] },
  gameplay: { path: "/gameplay", title: "GTA VI Gameplay", eyebrow: "Gameplay guide", description: "A source-led home for gameplay systems shown or described in approved materials.", searchIntent: "Understand confirmed GTA VI gameplay information without treating expectation as fact.", related: [{ label: "Trailers", href: "/trailers" }, { label: "Vehicles", href: "/vehicles" }, { label: "Map", href: "/map" }] },
  trailers: { path: "/trailers", title: "GTA VI Trailers", eyebrow: "Official media guide", description: "A chronological reference for official GTA VI trailers, original source links, and carefully labeled analysis.", searchIntent: "Find official GTA VI trailers and understand the details they visibly establish.", related: [{ label: "Gameplay", href: "/gameplay" }, { label: "Characters", href: "/characters" }, { label: "Latest news", href: "/news" }] },
  vehicles: { path: "/vehicles", title: "GTA VI Vehicles", eyebrow: "Vehicle reference", description: "A maintained reference for vehicles visible or described in approved GTA VI sources.", searchIntent: "Find confirmed and carefully sourced GTA VI vehicle information.", related: [{ label: "Gameplay", href: "/gameplay" }, { label: "Map", href: "/map" }, { label: "Trailers", href: "/trailers" }] },
  online: { path: "/online", title: "GTA VI Online", eyebrow: "Online guide", description: "A cautious guide to what has and has not been confirmed about online play connected to GTA VI.", searchIntent: "Understand official GTA VI online information while keeping assumptions and rumor separate.", related: [{ label: "Latest news", href: "/news" }, { label: "Gameplay", href: "/gameplay" }, { label: "Rumors", href: "/rumors" }] },
  rumors: { path: "/rumors", title: "GTA VI Rumors & Reports", eyebrow: "Claim tracker", description: "A controlled home for significant reports, rumors, speculation, and alleged leaks with prominent verification labels.", searchIntent: "Evaluate notable GTA VI claims by source quality and verification status.", related: [{ label: "Verification standard", href: "/verification" }, { label: "Latest news", href: "/news" }, { label: "Editorial policy", href: "/editorial-policy" }] },
};
