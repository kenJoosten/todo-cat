import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Field } from "./field";

test("the label names its input", () => {
  render(<Field label="Email" name="email" type="email" />);
  const input = screen.getByRole("textbox", { name: "Email" });
  expect(input.getAttribute("name")).toBe("email");
});
