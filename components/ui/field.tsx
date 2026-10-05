import type { ComponentProps } from "react";

type FieldProps = ComponentProps<"input"> & { name: string; label: string };

// A labelled text input; the input's id is its name, so keep names unique per page.
export function Field({ label, name, ...input }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="h-11 rounded-md border border-line bg-white px-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber"
        {...input}
      />
    </div>
  );
}
