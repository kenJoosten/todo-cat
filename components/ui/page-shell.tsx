import Link from "next/link";
import type { ReactNode } from "react";

// Every page: the todo-cat wordmark with optional actions (such as signing out) on one line,
// then the page itself, left-aligned. Narrow for forms; `wide` for the list beside the chat
// and for tools that need two columns.
export function PageShell({
  children,
  wide = false,
  actions,
}: {
  children: ReactNode;
  wide?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div
      className={`mx-auto flex w-full flex-1 flex-col px-5 pt-5 pb-12 sm:px-8 sm:pt-7 ${wide ? "max-w-6xl" : "max-w-xl"}`}
    >
      <header className="flex min-h-11 items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-sm font-display text-2xl leading-none font-medium tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          todo-cat
        </Link>
        {actions}
      </header>
      <main className={wide ? "mt-10 sm:mt-14" : "mt-16 sm:mt-24"}>
        {children}
      </main>
    </div>
  );
}
