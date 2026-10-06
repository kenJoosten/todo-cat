import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProgressBar } from "./progress-bar";

function bar() {
  const bar = screen.getByRole("progressbar", { name: "Todos done" });
  const fill = bar.firstElementChild;
  if (!(fill instanceof HTMLElement)) throw new Error("The bar has no fill");
  return { bar, fill };
}

test("fills the done share of the track, and says so to screen readers", () => {
  render(<ProgressBar value={3} max={4} label="Todos done" />);
  const { bar: progress, fill } = bar();
  expect(progress.getAttribute("aria-valuemin")).toBe("0");
  expect(progress.getAttribute("aria-valuemax")).toBe("4");
  expect(progress.getAttribute("aria-valuenow")).toBe("3");
  expect(progress.getAttribute("aria-valuetext")).toBe("3 of 4");
  expect(fill.style.width).toBe("75%");
});

test("an empty list is an empty bar, not a broken one", () => {
  render(<ProgressBar value={0} max={0} label="Todos done" />);
  const { bar: progress, fill } = bar();
  expect(progress.getAttribute("aria-valuenow")).toBe("0");
  expect(fill.style.width).toBe("0%");
});

test("a value outside the range stays inside the track", () => {
  const { rerender } = render(
    <ProgressBar value={7} max={5} label="Todos done" />,
  );
  expect(bar().fill.style.width).toBe("100%");
  expect(bar().bar.getAttribute("aria-valuenow")).toBe("5");
  rerender(<ProgressBar value={-1} max={5} label="Todos done" />);
  expect(bar().fill.style.width).toBe("0%");
});
