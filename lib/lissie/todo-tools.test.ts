import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RequestContext } from "@mastra/core/request-context";
import { noopObserve } from "@mastra/core/tools";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-tools-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
const { db } = await import("../db");
const { todos, user } = await import("../schema");
const { addTodo, getTodo, listTodos } = await import("../todo-service");
const { lissieRequestContext } = await import("./request-context");

const { todoTools } = await import("./todo-tools");
const { addTodoOutput, listTodosOutput, setTodoDoneOutput } = await import(
  "./todo-tool-schemas"
);
await migrate(db, { migrationsFolder: "drizzle" });

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A tool's `execute`, which Mastra's types leave optional. */
function executor<
  T extends { id: string; execute?: (...args: never[]) => unknown },
>(tool: T): NonNullable<T["execute"]> {
  const execute = tool.execute;
  if (!execute) throw new Error(`${tool.id} has no execute`);
  return execute;
}
const listTodosTool = executor(todoTools.listTodos);
const addTodoTool = executor(todoTools.addTodo);
const setTodoDoneTool = executor(todoTools.setTodoDone);

type ToolContext = Parameters<typeof addTodoTool>[1];

/**
 * What the agent hands a tool: its run's request context, as is. The tool's type names the
 * user id it needs, but nothing checks that until Mastra validates the context against the
 * tool's requestContextSchema at runtime, which is what these tests exercise.
 */
function toolContext(requestContext?: RequestContext): ToolContext {
  return { requestContext, observe: noopObserve } as ToolContext;
}

// Every tool runs with two users: Alice is signed in, Bob's todos must stay out of reach.
const alice = "user-alice";
const bob = "user-bob";
const asAlice = toolContext(lissieRequestContext(alice));

beforeEach(async () => {
  await db.delete(todos);
  await db.delete(user);
  await db.insert(user).values([
    { id: alice, name: "Alice", email: "alice@example.com" },
    { id: bob, name: "Bob", email: "bob@example.com" },
  ]);
});

function add(userId: string, title: string) {
  return addTodo(userId, { title, dueDate: null });
}

describe("listTodos", () => {
  test("lists the signed-in user's open todos by default", async () => {
    const tuna = await add(alice, "Buy tuna");
    const brushed = await add(alice, "Brush the cat");
    await setTodoDoneTool({ id: brushed.id, done: true }, asAlice);
    await add(bob, "Bob's secret");

    const result = listTodosOutput.parse(
      await listTodosTool({ status: "open" }, asAlice),
    );
    expect(result.todos).toEqual([tuna]);
  });

  test("filters by status and text, within the user's own todos", async () => {
    await add(alice, "Buy tuna");
    await add(alice, "Buy milk");
    await add(bob, "Buy milk");
    const result = listTodosOutput.parse(
      await listTodosTool({ status: "all", q: "MILK" }, asAlice),
    );
    expect(result.todos.map((todo) => todo.title)).toEqual(["Buy milk"]);
    expect(await listTodos(bob, { status: "all" })).toHaveLength(1);
  });
});

describe("addTodo", () => {
  test("adds an open todo for the signed-in user", async () => {
    const { todo } = addTodoOutput.parse(
      await addTodoTool({ title: "Buy milk", dueDate: "2026-10-07" }, asAlice),
    );
    expect(todo).toMatchObject({
      title: "Buy milk",
      dueDate: "2026-10-07",
      done: false,
    });
    expect(await getTodo(alice, todo.id)).toEqual(todo);
    expect(await listTodos(bob, { status: "all" })).toEqual([]);
  });

  test("ignores a user id the model puts in its arguments", async () => {
    const input = { title: "Buy milk", dueDate: null, userId: bob };
    const { todo } = addTodoOutput.parse(await addTodoTool(input, asAlice));
    expect(await getTodo(alice, todo.id)).toEqual(todo);
    expect(await listTodos(bob, { status: "all" })).toEqual([]);
  });

  test("rejects input the contract rejects, and adds nothing", async () => {
    const result = await addTodoTool(
      { title: "   ", dueDate: "next tuesday" },
      asAlice,
    );
    expect(result).toMatchObject({ error: true });
    expect(await listTodos(alice, { status: "all" })).toEqual([]);
  });
});

describe("setTodoDone", () => {
  test("marks the user's todo done and reopens it", async () => {
    const feed = await add(alice, "Feed the cat");
    const done = setTodoDoneOutput.parse(
      await setTodoDoneTool({ id: feed.id, done: true }, asAlice),
    );
    expect(done).toEqual({
      todo: { ...feed, done: true, completedAt: expect.any(String) },
    });
    const reopened = setTodoDoneOutput.parse(
      await setTodoDoneTool({ id: feed.id, done: false }, asAlice),
    );
    expect(reopened).toEqual({ todo: feed });
  });

  test("another user's todo is not found, and stays as it was", async () => {
    const bobs = await add(bob, "Bob's secret");
    const result = await setTodoDoneTool({ id: bobs.id, done: true }, asAlice);
    expect(result).toEqual({
      error: { code: "todo-not-found", message: `No todo with id ${bobs.id}` },
    });
    expect(await getTodo(bob, bobs.id)).toEqual(bobs);
  });
});

describe("without a signed-in user in the request context", () => {
  const contexts = {
    "no request context": toolContext(),
    "an empty request context": toolContext(new RequestContext()),
  };
  for (const [name, context] of Object.entries(contexts)) {
    test(`${name}: every tool refuses, and nothing changes`, async () => {
      const tuna = await add(alice, "Buy tuna");
      const calls = [
        listTodosTool({ status: "all" }, context),
        addTodoTool({ title: "Buy milk", dueDate: null }, context),
        setTodoDoneTool({ id: tuna.id, done: true }, context),
      ];
      for (const result of await Promise.all(calls)) {
        expect(result).toMatchObject({ error: true });
        expect(JSON.stringify(result)).not.toContain("Buy tuna");
      }
      expect(await listTodos(alice, { status: "all" })).toEqual([tuna]);
    });
  }
});
