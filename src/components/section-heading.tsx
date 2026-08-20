import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export function SectionHeading({
  eyebrow,
  title,
  description,
  link,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  link?: { label: string; href: string };
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 sm:mb-10">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 text-balance text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {link && (
        <Link
          href={link.href}
          className="hidden shrink-0 items-center gap-2 rounded-full border border-white/12 px-4 py-2.5 text-sm font-bold text-zinc-200 transition-colors hover:border-pink-300/40 hover:text-white sm:inline-flex"
        >
          {link.label}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
