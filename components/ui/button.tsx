import type { ComponentProps } from "react";

const variants = {
  // The page's one main action.
  primary: "bg-amber text-ink hover:bg-amber-deep",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-ground",
};

const sizes = {
  regular: "h-11 px-5",
  small: "h-8 px-3 text-sm",
};

export type ButtonStyle = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function buttonClass({
  variant = "primary",
  size = "regular",
}: ButtonStyle = {}) {
  return `rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]}`;
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
