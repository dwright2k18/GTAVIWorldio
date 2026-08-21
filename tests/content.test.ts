import { describe, expect, it } from "vitest";

import { articleBlocksToText, textToArticleBlocks } from "@/lib/cms/content";
import { suggestHubLinks } from "@/lib/cms/internal-links";

describe("structured article content", () => {
  it("preserves semantic H2, H3, quote, and list blocks", () => {
    const source = "Intro paragraph.\n\n## Confirmed details\n\n### Source context\n\n> A visible quote.\n\n- One\n- Two";
    const blocks = textToArticleBlocks(source);
    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "heading",
      "quote",
      "list",
    ]);
    expect(articleBlocksToText(blocks)).toBe(source);
  });

  it("suggests a limited set of relevant evergreen hubs", () => {
    const links = suggestHubLinks("Lucia appears in a trailer with Vice City map details and gameplay.", 3);
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.href)).toContain("/characters/lucia");
    expect(links.map((link) => link.href)).toContain("/map");
  });
});
