"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

const variants = {
  // The page's one main action.
  primary: "bg-amber text-ink hover:bg-amber-deep",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-ground",
};

// Submits its form and stays disabled while the form's action runs.
export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-11 rounded-md px-5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}
