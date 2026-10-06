import Link from "next/link";
import type { ComponentProps } from "react";

// An inline link inside running text.
export function TextLink(props: ComponentProps<typeof Link>) {
  return (
    <Link
      className="font-semibold text-ink underline decoration-amber decoration-2 underline-offset-4 hover:decoration-ink"
      {...props}
    />
  );
}
