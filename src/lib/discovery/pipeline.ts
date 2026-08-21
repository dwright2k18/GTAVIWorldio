import type { DiscoveryFetcher } from "./connectors/base";
import { connectorFor } from "./connectors";
import { buildSafeResearchPacket } from "./research";
import { scoreCandidate } from "./scoring";
import type { DiscoverySignals, DiscoverySource } from "./types";

export async function previewDiscoverySource(
  source: DiscoverySource,
  options: { fetcher?: DiscoveryFetcher; signals?: DiscoverySignals } = {},
) {
  const result = await connectorFor(source).fetch(source, options.fetcher);
  return {
    ...result,
    candidates: result.items.map((item) => {
      const scored = scoreCandidate(source, item, options.signals);
      return {
        isTest: true as const,
        scored,
        research: buildSafeResearchPacket(scored),
      };
    }),
  };
}

export function recurringDiscoveryEnabled() {
  return process.env.DISCOVERY_RECURRING_ENABLED === "true";
}

export function automaticDraftingEnabled() {
  return process.env.DISCOVERY_AUTOMATIC_DRAFTING_ENABLED === "true";
}
