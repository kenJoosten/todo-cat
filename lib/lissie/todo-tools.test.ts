import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { A2uiMessageListSchema } from "@a2ui/web_core/v0_9";
import {
  type A2UIValidationCatalog,
  validateA2UIComponents,
} from "@ag-ui/a2ui-toolkit";
import { extractCatalogComponentSchemas } from "@copilotkit/a2ui-renderer";
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
const { lissieThreadId } = await import("./thread");

const { todoTools } = await import("./todo-tools");
const {
  addTodoOutput,
  listTodosOutput,
  setTodoDoneOutput,
  showProgressOutput,
} = await import("./todo-tool-schemas");
const { lissieCatalog } = await import("./a2ui-catalog");
const { progressCard } = await import("./progress-card");
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
const showProgressTool = executor(todoTools.showProgress);

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
const asAlice = toolContext(lissieRequestContext(alice, lissieThreadId(alice)));

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

describe("showProgress", () => {
  // The catalog the chat registers, in the shape the A2UI middleware validates against.
  const { catalogId, components: schemas } =
    extractCatalogComponentSchemas(lissieCatalog);
  const catalog: A2UIValidationCatalog = {
    components: Object.fromEntries(
      Object.entries(schemas).map(([name, schema]) => [
        name,
        (schema.allOf as A2UIValidationCatalog["components"][string][])[1],
      ]),
    ),
  };

  async function showProgress() {
    const { a2ui_operations } = showProgressOutput.parse(
      await showProgressTool({}, asAlice),
    );
    const operations = A2uiMessageListSchema.parse(a2ui_operations);
    const [create, update, data] = operations;
    if (
      !("createSurface" in create) ||
      !("updateComponents" in update) ||
      !("updateDataModel" in data)
    ) {
      throw new Error(
        "Expected createSurface, updateComponents, updateDataModel",
      );
    }
    return {
      create: create.createSurface,
      components: update.updateComponents.components,
      data: data.updateDataModel,
    };
  }

  test("draws one well-formed card on Lissie's catalog", async () => {
    const { create, components, data } = await showProgress();
    expect(create.catalogId).toBe(catalogId);
    expect(data.surfaceId).toBe(create.surfaceId);
    expect(data.path).toBe("/");
    // Known components with their required props, children that exist, no cycles, and
    // every data binding resolving in the data model: what the middleware checks.
    expect(
      validateA2UIComponents({ components, data: data.value, catalog }),
    ).toEqual({ valid: true, errors: [] });
    expect(components.filter((c) => c.id === "root")).toHaveLength(1);
  });

  test("counts the signed-in user's todos, and only theirs", async () => {
    const titles = ["Buy tuna", "Brush the cat", "Feed the cat", "Buy milk"];
    const added = await Promise.all(titles.map((title) => add(alice, title)));
    for (const todo of added.slice(0, 3)) {
      await setTodoDoneTool({ id: todo.id, done: true }, asAlice);
    }
    await add(alice, "Call the vet");
    await add(bob, "Bob's secret");

    const { data } = await showProgress();
    const rows = await listTodos(alice, { status: "all" });
    expect(data.value).toEqual({
      total: rows.length,
      done: rows.filter((todo) => todo.done).length,
      open: rows.filter((todo) => !todo.done).length,
    });
    expect(data.value).toEqual({ total: 5, done: 3, open: 2 });
  });

  test("the numbers are bound, never written into the tree", async () => {
    await add(alice, "Buy tuna");
    const { components } = await showProgress();
    const empty = progressCard({ total: 0, done: 0, open: 0 });
    expect(empty.a2ui_operations[1]).toEqual({
      version: "v0.9",
      updateComponents: { surfaceId: "todo-progress", components },
    });
    // Every placeholder in a formatted Text names a value in the data model.
    const json = JSON.stringify(components);
    const paths = [...json.matchAll(/\$\{(\/[^}]*)\}/g)].map(
      ([, path]) => path,
    );
    expect(new Set(paths)).toEqual(new Set(["/done", "/total", "/open"]));
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
        showProgressTool({}, context),
      ];
      for (const result of await Promise.all(calls)) {
        expect(result).toMatchObject({ error: true });
        expect(JSON.stringify(result)).not.toContain("Buy tuna");
      }
      expect(await listTodos(alice, { status: "all" })).toEqual([tuna]);
    });
  }
});
