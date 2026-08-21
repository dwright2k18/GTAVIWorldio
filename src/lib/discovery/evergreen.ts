type EvergreenMatch = {
  path: string;
  reason: string;
  terms: RegExp;
};

const evergreenMatches: EvergreenMatch[] = [
  { path: "/release-date", reason: "Release timing or delay information may change the release-date guide.", terms: /\b(?:release date|delay|launch window|launch date)\b/i },
  { path: "/characters/lucia", reason: "The development concerns Lucia or her official character record.", terms: /\blucia\b/i },
  { path: "/characters/jason", reason: "The development concerns Jason or his official character record.", terms: /\bjason\b/i },
  { path: "/map", reason: "The development contains location, map, Vice City, or world information.", terms: /\b(?:map|vice city|location|leonida|world)\b/i },
  { path: "/gameplay", reason: "The development may change the gameplay evidence guide.", terms: /\b(?:gameplay|mechanic|feature|combat|mission)\b/i },
  { path: "/trailers", reason: "The development concerns an official trailer or footage release.", terms: /\b(?:trailer|footage|video premiere)\b/i },
  { path: "/online", reason: "The development concerns GTA VI online or multiplayer information.", terms: /\b(?:online|multiplayer)\b/i },
  { path: "/vehicles", reason: "The development concerns vehicles shown or described for GTA VI.", terms: /\b(?:vehicle|car|motorcycle|boat|aircraft)\b/i },
];

export function detectEvergreenOpportunity(title: string, summary = "") {
  const haystack = `${title} ${summary}`;
  const match = evergreenMatches.find((entry) => entry.terms.test(haystack));
  return match
    ? { recommended: true, path: match.path, reason: match.reason }
    : { recommended: false, path: null, reason: null };
}
export function suggestedInternalLinks(title: string, summary = "") {
  const matches = evergreenMatches.filter((entry) => entry.terms.test(`${title} ${summary}`));
  return matches.slice(0, 4).map(({ path, reason }) => ({ path, reason }));
}
