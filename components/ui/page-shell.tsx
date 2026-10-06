import type { ReactNode } from "react";

// The single left-aligned column every page sits in, under the todo-cat wordmark;
// `wide` is for tools that need two columns side by side.
export function PageShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto flex w-full flex-1 flex-col px-6 py-10 sm:py-16 ${wide ? "max-w-6xl" : "max-w-md"}`}
    >
      <p className="font-display text-lg font-semibold tracking-tight">
        todo-cat
      </p>
      <main className="mt-16 sm:mt-24">{children}</main>
    </div>
  );
}
