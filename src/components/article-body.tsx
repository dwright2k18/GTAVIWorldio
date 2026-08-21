import type { ArticleBodyBlock } from "@/db/schema";

export function ArticleBody({ blocks }: { blocks: ArticleBodyBlock[] }) {
  return (
    <div className="space-y-6 text-lg leading-8 text-slate-200">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          return block.level === 3 ? (
            <h3 className="pt-4 text-2xl font-black text-white" key={key}>{block.content}</h3>
          ) : (
            <h2 className="pt-6 text-3xl font-black text-white" key={key}>{block.content}</h2>
          );
        }
        if (block.type === "quote") {
          return <blockquote className="border-l-4 border-cyan-300 bg-cyan-300/[0.06] px-6 py-4 text-xl italic" key={key}>{block.content}{block.attribution ? <footer className="mt-3 text-sm not-italic text-slate-400">— {block.attribution}</footer> : null}</blockquote>;
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return <List className={`space-y-2 pl-7 ${block.ordered ? 'list-decimal' : 'list-disc'}`} key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</List>;
        }
        return <p key={key}>{block.content}</p>;
      })}
    </div>
  );
}
