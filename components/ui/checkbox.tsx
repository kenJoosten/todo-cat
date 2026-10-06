import type { ComponentProps } from "react";

// A checkbox drawn in the palette: an ink outline, filled with her amber when checked.
// A native input underneath, so labels, keyboard and screen readers work as usual.
export function Checkbox(props: Omit<ComponentProps<"input">, "type">) {
  return (
    <span className="relative grid size-5 shrink-0 place-items-center">
      <input
        type="checkbox"
        className="peer size-5 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-ink bg-surface transition-colors checked:border-amber checked:bg-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait"
        {...props}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute hidden size-3.5 fill-none stroke-on-amber stroke-[2.25] peer-checked:block"
      >
        <path
          d="M3 8.5 6.5 12 13 4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
