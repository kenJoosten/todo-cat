import type { ComponentProps } from "react";

const variants = {
  // The page's one main action: her amber eye.
  primary: "bg-amber text-on-amber hover:bg-amber-deep",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-ground",
  // Confirms something that can't be undone, such as deleting a todo.
  danger: "bg-danger text-ground hover:opacity-90",
  // A small action in a row that shouldn't compete with the content, such as delete.
  quiet: "text-muted hover:bg-ink/8 hover:text-ink",
};

const sizes = {
  regular: "h-11 px-5",
  // Looks 32px tall, but its hit area reaches 44px, the smallest comfortable touch target.
  small:
    "relative h-8 px-3 text-sm after:absolute after:inset-x-0 after:-inset-y-1.5",
  // A square button for an icon with an aria-label, at the 44px touch target.
  icon: "grid size-11 place-items-center",
};

export type ButtonStyle = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function buttonClass({
  variant = "primary",
  size = "regular",
}: ButtonStyle = {}) {
  return `shrink-0 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]}`;
}

// A button that runs a click handler; forms use SubmitButton instead.
export function Button({
  variant,
  size,
  type = "button",
  ...button
}: ComponentProps<"button"> & ButtonStyle) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size })}
      {...button}
    />
  );
}
