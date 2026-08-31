export function shouldCreateCandidateForSnapshot(options: {
  connectorKind: "RSS" | "ATOM" | "HTML_LISTING" | "HTML_CHANGE" | "JSON_FEED" | "MANUAL";
  isInitialBaseline: boolean;
  wasPreviouslySeen: boolean;
}) {
  if (options.wasPreviouslySeen) return false;
  if (options.isInitialBaseline && options.connectorKind !== "MANUAL") return false;
  return true;
}

export function excludePreviouslySeenItems<T extends { contentHash: string }>(
  items: T[],
  previousContentHashes: ReadonlySet<string>,
) {
  return items.filter((item) => !previousContentHashes.has(item.contentHash));
}
