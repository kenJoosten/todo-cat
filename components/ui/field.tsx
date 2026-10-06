import type { ComponentProps, ReactNode } from "react";

const controlClass =
  "rounded-md border border-edge bg-surface px-3 text-ink outline-none transition-colors placeholder:text-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber";

/** The id of a control's hint, which the control names as its description. */
function hintId(name: string, hint: ReactNode) {
  return hint ? `${name}-hint` : undefined;
}

// The label above a control, with an optional hint under it; the control's id is its name.
function Labelled({
  label,
  name,
  hint,
  children,
}: {
  label: string;
  name: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId(name, hint)} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

type FieldProps<T extends "input" | "textarea" | "select"> =
  ComponentProps<T> & { name: string; label: string; hint?: ReactNode };

// A labelled text input; the input's id is its name, so keep names unique per page.
// `mono` sets the value in the monospace face, for ids and tokens.
export function Field({
  label,
  name,
  hint,
  mono = false,
  ...input
}: FieldProps<"input"> & { mono?: boolean }) {
  return (
    <Labelled label={label} name={name} hint={hint}>
      <input
        id={name}
        name={name}
        aria-describedby={hintId(name, hint)}
        className={`h-11 ${controlClass} ${mono ? "font-mono text-sm placeholder:font-sans" : "text-base"}`}
        {...input}
      />
    </Labelled>
  );
}

// A labelled multi-line input in the monospace face, for code such as JSON.
export function CodeField({
  label,
  name,
  hint,
  ...textarea
}: FieldProps<"textarea">) {
  return (
    <Labelled label={label} name={name} hint={hint}>
      <textarea
        id={name}
        name={name}
        aria-describedby={hintId(name, hint)}
        spellCheck={false}
        className={`min-h-28 py-2 font-mono text-sm leading-relaxed ${controlClass}`}
        {...textarea}
      />
    </Labelled>
  );
}

// A labelled drop-down.
export function SelectField({
  label,
  name,
  hint,
  ...select
}: FieldProps<"select">) {
  return (
    <Labelled label={label} name={name} hint={hint}>
      <select
        id={name}
        name={name}
        aria-describedby={hintId(name, hint)}
        className={`h-11 text-base ${controlClass}`}
        {...select}
      />
    </Labelled>
  );
}
