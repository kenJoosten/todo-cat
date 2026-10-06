import type { ReactNode } from "react";

// A heading inside a page, in Imbue, with an optional count beside it, such as "Open 4".
export function SectionHeading({
  id,
  children,
  count,
}: {
  id?: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <h2
      id={id}
      className="flex items-baseline gap-2.5 font-display text-3xl leading-tight font-medium tracking-tight"
    >
      {children}
      {count !== undefined && (
        <span className="font-sans text-base font-normal text-muted tabular-nums">
          {count}
        </span>
      )}
    </h2>
  );
}
