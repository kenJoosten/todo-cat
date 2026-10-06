import type { ReactNode } from "react";

const sizes = {
  // A page whose title is the point, such as sign-in: Imbue at its tallest.
  page: "text-6xl sm:text-7xl",
  // A page whose content is the point, such as the list: the title steps back.
  compact: "text-5xl",
};

// The page's one big line, in Lissie's voice, with an optional plain-spoken lead below it.
export function PageTitle({
  children,
  lead,
  size = "page",
}: {
  children: ReactNode;
  lead?: ReactNode;
  size?: keyof typeof sizes;
}) {
  return (
    <header>
      <h1
        className={`font-display leading-[0.95] font-medium tracking-tight text-balance ${sizes[size]}`}
      >
        {children}
      </h1>
      {lead && (
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-pretty text-muted">
          {lead}
        </p>
      )}
    </header>
  );
}
