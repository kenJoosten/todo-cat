import type { ComponentProps, ReactNode } from "react";

// Vertical stack of fields, error and submit button.
export function Form(props: ComponentProps<"form">) {
  return <form className="mt-10 flex flex-col gap-5" {...props} />;
}

// A quiet line under a form, such as the link to the other auth page.
export function FormNote({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-muted">{children}</p>;
}
