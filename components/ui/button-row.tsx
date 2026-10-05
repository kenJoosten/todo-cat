import type { ReactNode } from "react";

// Buttons side by side, such as a choice between approving and denying; each may be its own form.
export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="mt-10 flex flex-wrap gap-3">{children}</div>;
}
