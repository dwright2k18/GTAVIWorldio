export function shouldCreateCandidateForSnapshot(options: {
  connectorKind: "RSS" | "ATOM" | "HTML_LISTING" | "HTML_CHANGE" | "JSON_FEED" | "MANUAL";
  isInitialBaseline: boolean;
  wasPreviouslySeen: boolean;
}) {
  if (options.wasPreviouslySeen) return false;
  if (options.isInitialBaseline && options.connectorKind !== "MANUAL") return false;
  return true;
}
