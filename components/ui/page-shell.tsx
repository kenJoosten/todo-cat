import type { ReactNode } from "react";

// The single left-aligned column every page sits in, under the todo-cat wordmark.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10 sm:py-16">
      <p className="font-display text-lg font-semibold tracking-tight">
        todo-cat
      </p>
      <main className="mt-16 sm:mt-24">{children}</main>
    </div>
  );
}
