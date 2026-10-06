import type { ReactNode } from "react";

export type Choice<T extends string> = {
  value: T;
  label: ReactNode;
  description?: ReactNode;
};

// A set of radio buttons drawn as rows, the chosen one outlined in ink.
export function ChoiceGroup<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {choices.map((choice) => (
        <label
          key={choice.value}
          className="flex cursor-pointer items-baseline gap-3 rounded-md border border-edge bg-surface px-3 py-2.5 transition-colors hover:border-ink has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:ring-2 has-focus-visible:ring-amber"
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={choice.value === value}
            onChange={() => onChange(choice.value)}
            className="accent-ink"
          />
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="min-w-0">{choice.label}</span>
            {choice.description && (
              <span className="text-sm text-muted">{choice.description}</span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
