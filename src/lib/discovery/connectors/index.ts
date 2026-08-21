import type { DiscoverySource } from "../types";
import type { SourceConnector } from "./base";
import { FeedConnector, JsonFeedConnector } from "./feeds";
import { HtmlChangeConnector, HtmlListingConnector } from "./html";

const feedConnector = new FeedConnector();
const connectors: Partial<Record<DiscoverySource["connectorKind"], SourceConnector>> = {
  RSS: feedConnector,
  ATOM: feedConnector,
  JSON_FEED: new JsonFeedConnector(),
  HTML_LISTING: new HtmlListingConnector(),
  HTML_CHANGE: new HtmlChangeConnector(),
};

export function connectorFor(source: DiscoverySource) {
  const connector = connectors[source.connectorKind];
  if (!connector) {
    throw new Error(`The ${source.connectorKind} connector requires manual editorial handling.`);
  }
  return connector;
}
