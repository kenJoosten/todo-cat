import type { ReactNode } from "react";

// The page's one big line, in Lissie's voice, with an optional plain-spoken lead below it.
export function PageTitle({
  children,
  lead,
}: {
  children: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header>
      <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight text-balance">
        {children}
      </h1>
      {lead && (
        <p className="mt-4 text-lg leading-relaxed text-pretty text-muted">
          {lead}
        </p>
      )}
    </header>
  );
}
