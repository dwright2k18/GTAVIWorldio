import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="overflow-hidden text-sm text-zinc-500">
      <ol className="flex min-w-0 items-center gap-2">
        {items.map((item, index) => {
          const isCurrent = !item.href;

          return (
          <li
            key={`${item.label}-${index}`}
            className={`flex items-center gap-2 ${isCurrent ? "min-w-0" : "shrink-0"}`}
          >
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className="truncate text-zinc-300" aria-current="page" title={item.label}>
                {item.label}
              </span>
            )}
          </li>
        )})}
      </ol>
    </nav>
  );
}
