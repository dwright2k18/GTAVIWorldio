import Image from "next/image";

type CmsEditorialImageProps = {
  media: {
    url: string;
    altText: string | null;
    caption: string | null;
    credit: string | null;
    width: number | null;
    height: number | null;
  };
  priority?: boolean;
};

export function CmsEditorialImage({ media, priority = false }: CmsEditorialImageProps) {
  if (!media.altText || !media.width || !media.height) return null;

  return <figure><Image alt={media.altText} className="h-auto w-full object-cover" height={media.height} priority={priority} sizes="(max-width: 768px) 100vw, 1152px" src={media.url} width={media.width} />{media.caption || media.credit ? <figcaption className="flex flex-wrap justify-between gap-3 border-t border-white/10 bg-black/30 px-5 py-3 text-xs text-zinc-400">{media.caption ? <span>{media.caption}</span> : null}{media.credit ? <span>Credit: {media.credit}</span> : null}</figcaption> : null}</figure>;
}
