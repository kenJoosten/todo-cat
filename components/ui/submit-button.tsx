"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { type ButtonStyle, buttonClass } from "./button";

// Submits its form and stays disabled while the form's action runs.
export function SubmitButton({
  children,
  variant,
  size,
}: { children: ReactNode } & Pick<ButtonStyle, "variant" | "size">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${buttonClass({ variant, size })} disabled:cursor-wait`}
    >
      {children}
    </button>
  );
}
