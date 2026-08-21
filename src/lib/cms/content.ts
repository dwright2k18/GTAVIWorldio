import type { ArticleBodyBlock } from "@/db/schema";

export function textToArticleBlocks(value: string): ArticleBodyBlock[] {
  const sections = value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.map((section) => {
    if (section.startsWith("### ")) {
      return { type: "heading", level: 3, content: section.slice(4).trim() };
    }
    if (section.startsWith("## ")) {
      return { type: "heading", level: 2, content: section.slice(3).trim() };
    }
    if (section.startsWith("> ")) {
      return { type: "quote", content: section.slice(2).trim() };
    }

    const lines = section.split("\n");
    if (lines.every((line) => /^[-*] /.test(line))) {
      return {
        type: "list",
        items: lines.map((line) => line.replace(/^[-*] /, "").trim()),
      };
    }
    if (lines.every((line) => /^\d+\. /.test(line))) {
      return {
        type: "list",
        ordered: true,
        items: lines.map((line) => line.replace(/^\d+\. /, "").trim()),
      };
    }

    return { type: "paragraph", content: section };
  });
}

export function articleBlocksToText(blocks: ArticleBodyBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        return `${"#".repeat(block.level)} ${block.content}`;
      }
      if (block.type === "quote") return `> ${block.content}`;
      if (block.type === "list") {
        return block.items
          .map((item, index) =>
            block.ordered ? `${index + 1}. ${item}` : `- ${item}`,
          )
          .join("\n");
      }
      return block.content;
    })
    .join("\n\n");
}
