import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

// The Server Actions' mapping only: who is signed in, input errors, not-found, refresh.
// The session is whatever `session.userId` says; the service runs on a temp database.
const session = vi.hoisted(() => ({ userId: null as string | null }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getUserId: async () => session.userId }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ refresh }));

const dir = mkdtempSync(join(tmpdir(), "todo-cat-actions-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
const { db } = await import("@/lib/db");
const { todos, user } = await import("@/lib/schema");
const { addTodo, getTodo, listTodos } = await import("@/lib/todo-service");
const { addTodoAction, deleteTodoAction, setTodoDoneAction } = await import(
  "./todo-actions"
);
await migrate(db, { migrationsFolder: "drizzle" });

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const alice = "user-alice";
const bob = "user-bob";

beforeEach(async () => {
  await db.delete(todos);
  await db.delete(user);
  await db.insert(user).values([
    { id: alice, name: "Alice", email: "alice@example.com" },
    { id: bob, name: "Bob", email: "bob@example.com" },
  ]);
  session.userId = alice;
  refresh.mockClear();
});

describe("signed out", () => {
  test("every action is unauthorized, and nothing changes", async () => {
    const tuna = await addTodo(alice, { title: "Buy tuna", dueDate: null });
    session.userId = null;
    for (const result of [
      await addTodoAction({ title: "Buy milk", dueDate: null }),
      await setTodoDoneAction(tuna.id, true),
      await deleteTodoAction(tuna.id),
    ]) {
      expect(result).toMatchObject({ error: { code: "unauthorized" } });
    }
    expect(await listTodos(alice, { status: "all" })).toEqual([tuna]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("signed in", () => {
  test("adding parses the input with the contract and refreshes the page", async () => {
    expect(
      await addTodoAction({ title: "  Buy milk ", dueDate: "2031-10-09" }),
    ).toEqual({});
    const [milk] = await listTodos(alice, { status: "all" });
    expect(milk).toMatchObject({ title: "Buy milk", dueDate: "2031-10-09" });
    expect(await listTodos(bob, { status: "all" })).toEqual([]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  test("input the contract rejects fails validation, and nothing changes", async () => {
    for (const result of [
      await addTodoAction({ title: "   ", dueDate: null }),
      await addTodoAction({ title: "Buy milk", dueDate: "next friday" }),
      await setTodoDoneAction("", true),
      await setTodoDoneAction("some-id", "yes"),
      await deleteTodoAction(42),
    ]) {
      expect(result).toMatchObject({ error: { code: "validation-failed" } });
    }
    expect(await listTodos(alice, { status: "all" })).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  test("checks off, reopens and deletes the user's own todo", async () => {
    const feed = await addTodo(alice, { title: "Feed the cat", dueDate: null });
    expect(await setTodoDoneAction(feed.id, true)).toEqual({});
    expect(await getTodo(alice, feed.id)).toMatchObject({ done: true });
    expect(await setTodoDoneAction(feed.id, false)).toEqual({});
    expect(await getTodo(alice, feed.id)).toMatchObject({ done: false });
    expect(await deleteTodoAction(feed.id)).toEqual({});
    expect(await listTodos(alice, { status: "all" })).toEqual([]);
  });

  test("another user's todo is not found, and stays as it was", async () => {
    const bobs = await addTodo(bob, { title: "Bob's secret", dueDate: null });
    expect(await setTodoDoneAction(bobs.id, true)).toMatchObject({
      error: { code: "todo-not-found" },
    });
    expect(await deleteTodoAction(bobs.id)).toMatchObject({
      error: { code: "todo-not-found" },
    });
    expect(await getTodo(bob, bobs.id)).toEqual(bobs);
  });
});
