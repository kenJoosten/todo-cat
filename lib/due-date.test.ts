import { expect, test } from "vitest";
import { dueDateLabel } from "./due-date";

test("a due date reads as day and month, on the day it names", () => {
  expect(dueDateLabel("2026-10-09")).toBe("9 Oct");
  expect(dueDateLabel("2027-01-01")).toBe("1 Jan");
  expect(dueDateLabel("2026-12-31")).toBe("31 Dec");
});
