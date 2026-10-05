import { describe, expect, test } from "vitest";
import {
  errorBodySchema,
  newTodoSchema,
  todoListFilterSchema,
  todoUpdateSchema,
} from "./index";

describe("newTodoSchema", () => {
  test("trims the title and defaults the due date to null", () => {
    expect(newTodoSchema.parse({ title: "  Buy tuna " })).toEqual({
      title: "Buy tuna",
      dueDate: null,
    });
  });

  test("rejects a blank title", () => {
    expect(newTodoSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  test("accepts only real yyyy-mm-dd dates", () => {
    const due = (dueDate: string) =>
      newTodoSchema.safeParse({ title: "Vet", dueDate }).success;
    expect(due("2028-02-29")).toBe(true);
    expect(due("2026-02-29")).toBe(false);
    expect(due("2026-10-05T12:00:00Z")).toBe(false);
    expect(due("5-10-2026")).toBe(false);
  });
});

describe("todoUpdateSchema", () => {
  test("keeps absent fields absent and null due dates null", () => {
    expect(todoUpdateSchema.parse({ dueDate: null })).toEqual({
      dueDate: null,
    });
  });
});

describe("todoListFilterSchema", () => {
  test("lists open todos by default", () => {
    expect(todoListFilterSchema.parse({})).toEqual({ status: "open" });
  });

  test("rejects an unknown status", () => {
    expect(todoListFilterSchema.safeParse({ status: "later" }).success).toBe(
      false,
    );
  });
});

describe("errorBodySchema", () => {
  test("accepts only known error codes", () => {
    const body = (code: string) =>
      errorBodySchema.safeParse({ error: { code, message: "Nope" } }).success;
    expect(body("todo-not-found")).toBe(true);
    expect(body("forbidden")).toBe(false);
  });
});
