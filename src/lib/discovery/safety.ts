const blockedAssetExtensions = /\.(?:exe|dmg|pkg|zip|rar|7z|torrent|iso|bin|apk)(?:$|[?#])/i;
const privateHostPatterns = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
];

export function assertSafeDiscoveryUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Discovery connectors require HTTPS sources.");
  }
  if (url.username || url.password) {
    throw new Error("Discovery source URLs cannot contain credentials.");
  }
  if (privateHostPatterns.some((pattern) => pattern.test(url.hostname))) {
    throw new Error("Private and local network targets are not allowed.");
  }
  if (blockedAssetExtensions.test(url.pathname)) {
    throw new Error("Binary, archive, and torrent assets are not ingestible sources.");
  }
  return url;
}

export function discoveryUrlMatchesDomain(value: string | URL, domain: string) {
  const hostname = (value instanceof URL ? value : new URL(value)).hostname.toLowerCase();
  const normalizedDomain = domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

export function classifyMediaRights(options: {
  isFirstParty: boolean;
  authorityTier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
  sourceUrl: string;
}) {
  if (blockedAssetExtensions.test(options.sourceUrl)) return "DO_NOT_HOST" as const;
  if (options.authorityTier === "TIER_4") return "DO_NOT_HOST" as const;
  if (options.isFirstParty) return "OFFICIAL_EMBEDDABLE" as const;
  if (options.authorityTier === "TIER_3") return "COMMENTARY_ONLY" as const;
  return "UNKNOWN_RIGHTS" as const;
}

export const leakSafetyNotice =
  "Store only a text description, legally appropriate source URL, verification notes, and public reporting references. Never download or mirror alleged leaked assets.";
