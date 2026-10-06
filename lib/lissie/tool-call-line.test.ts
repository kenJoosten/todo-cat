import type { Todo } from "@todo-cat/contract";
import { describe, expect, test } from "vitest";
import { toolCallLine } from "./tool-call-line";

const milk: Todo = {
  id: "t1",
  title: "Buy milk",
  dueDate: null,
  done: false,
  createdAt: "2026-10-06T09:00:00.000Z",
  completedAt: null,
};
const fed: Todo = {
  ...milk,
  id: "t2",
  title: "Feed the cat",
  done: true,
  completedAt: "2026-10-06T10:00:00.000Z",
};

const json = JSON.stringify;
// What Mastra returns to the model when a tool refuses its input or request context.
const refused = json({ error: true, message: "Tool validation failed" });

describe("listTodos", () => {
  test("says what she looked at, and how much she found", () => {
    expect(toolCallLine("listTodos", {}, undefined)).toEqual({
      text: "Looked at your open todos…",
      state: "running",
    });
    expect(
      toolCallLine(
        "listTodos",
        { status: "all" },
        json({ todos: [milk, fed] }),
      ),
    ).toEqual({ text: "Looked at your todos (2)", state: "done" });
    expect(
      toolCallLine(
        "listTodos",
        { status: "done", q: "tuna" },
        json({ todos: [] }),
      ),
    ).toEqual({
      text: "Searched your done todos for “tuna” (none)",
      state: "done",
    });
  });

  test("a refused call fails", () => {
    expect(toolCallLine("listTodos", {}, refused)).toEqual({
      text: "Couldn't look at your list",
      state: "failed",
    });
  });
});

describe("addTodo", () => {
  test("names the todo, and its due date once added", () => {
    expect(toolCallLine("addTodo", { title: "Buy milk" }, undefined)).toEqual({
      text: "Adding “Buy milk”…",
      state: "running",
    });
    const due = { ...milk, dueDate: "2026-10-07" };
    expect(
      toolCallLine("addTodo", { title: "Buy milk" }, json({ todo: due })),
    ).toEqual({ text: "Added “Buy milk”, due 7 Oct", state: "done" });
  });

  test("a refused call fails, and arguments still streaming in are fine", () => {
    expect(toolCallLine("addTodo", { title: "  " }, refused)).toEqual({
      text: "Couldn't add a todo",
      state: "failed",
    });
    expect(toolCallLine("addTodo", {}, undefined)).toEqual({
      text: "Adding a todo…",
      state: "running",
    });
  });
});

describe("setTodoDone", () => {
  test("names the todo it marked done or reopened", () => {
    expect(
      toolCallLine(
        "setTodoDone",
        { id: "t2", done: true },
        json({ todo: fed }),
      ),
    ).toEqual({ text: "Marked “Feed the cat” done", state: "done" });
    expect(
      toolCallLine(
        "setTodoDone",
        { id: "t1", done: false },
        json({ todo: milk }),
      ),
    ).toEqual({ text: "Reopened “Buy milk”", state: "done" });
    expect(
      toolCallLine("setTodoDone", { id: "t1", done: false }, undefined),
    ).toEqual({ text: "Reopening a todo…", state: "running" });
  });

  test("a todo that is not found fails", () => {
    const notFound = { code: "todo-not-found", message: "No todo with id x" };
    expect(
      toolCallLine(
        "setTodoDone",
        { id: "x", done: true },
        json({ error: notFound }),
      ),
    ).toEqual({ text: "Couldn't find that todo", state: "failed" });
  });
});

test("a result that is not JSON fails instead of throwing", () => {
  expect(toolCallLine("addTodo", { title: "Buy milk" }, "oops")).toEqual({
    text: "Couldn't add “Buy milk”",
    state: "failed",
  });
});
