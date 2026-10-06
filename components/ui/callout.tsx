import type { ReactNode } from "react";

// A short warning the user must read before acting, set apart from the running text.
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 border-l-4 border-amber bg-surface py-3 pr-4 pl-4 leading-relaxed text-pretty">
      {children}
    </div>
  );
}
