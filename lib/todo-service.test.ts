import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { todoSchema } from "@todo-cat/contract";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-todo-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
const { db } = await import("./db");
const { todos, user } = await import("./schema");
const service = await import("./todo-service");
const { compareTodos } = await import("./todo-order");
const {
  addTodo,
  deleteTodo,
  getTodo,
  listTodos,
  replaceTodos,
  TodoNotFoundError,
  updateTodo,
} = service;
await migrate(db, { migrationsFolder: "drizzle" });

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

// Every use case runs with two users: Alice acts, Bob's todos must stay out of reach.
const alice = "user-alice";
const bob = "user-bob";

beforeEach(async () => {
  await db.delete(user);
  await db.insert(user).values([
    { id: alice, name: "Alice", email: "alice@example.com" },
    { id: bob, name: "Bob", email: "bob@example.com" },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

function add(userId: string, title: string, dueDate: string | null = null) {
  return addTodo(userId, { title, dueDate });
}

const notFound = { code: "todo-not-found" };

describe("addTodo", () => {
  test("returns an open contract todo", async () => {
    const todo = await add(alice, "Buy tuna", "2026-10-31");
    expect(todoSchema.parse(todo)).toEqual(todo);
    expect(todo).toMatchObject({
      title: "Buy tuna",
      dueDate: "2026-10-31",
      done: false,
      completedAt: null,
    });
  });

  test("the todo belongs to its creator only", async () => {
    const todo = await add(alice, "Buy tuna");
    expect(await getTodo(alice, todo.id)).toEqual(todo);
    await expect(getTodo(bob, todo.id)).rejects.toMatchObject(notFound);
  });
});

describe("listTodos", () => {
  test("lists only the user's own todos", async () => {
    await add(alice, "Alice's todo");
    await add(bob, "Bob's todo");
    const titles = (await listTodos(alice, { status: "all" })).map(
      (t) => t.title,
    );
    expect(titles).toEqual(["Alice's todo"]);
  });

  test("filters by status", async () => {
    const done = await add(alice, "Done");
    await updateTodo(alice, done.id, { done: true });
    await add(alice, "Open");
    await updateTodo(bob, (await add(bob, "Bob done")).id, { done: true });
    await add(bob, "Bob open");

    const titles = async (status: "open" | "done" | "all") =>
      (await listTodos(alice, { status })).map((t) => t.title);
    expect(await titles("open")).toEqual(["Open"]);
    expect(await titles("done")).toEqual(["Done"]);
    expect(await titles("all")).toEqual(["Open", "Done"]);
  });

  test("filters by text, case-insensitively and literally", async () => {
    await add(alice, "Brush the CAT");
    await add(alice, "Feed the dog");
    await add(alice, "100% tuna");
    await add(bob, "Pet the cat");

    const titles = async (q: string) =>
      (await listTodos(alice, { status: "all", q })).map((t) => t.title);
    expect(await titles("cat")).toEqual(["Brush the CAT"]);
    expect(await titles("%")).toEqual(["100% tuna"]);
    expect(await titles("_")).toEqual([]);
  });

  test("sorts open before done, then by due date, then newest first", async () => {
    // Pin the clock, so the two undated todos can't share a creation millisecond.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    await add(alice, "No date, older");
    await add(alice, "Due later", "2026-12-01");
    vi.setSystemTime(new Date("2026-10-02T09:00:00Z"));
    await add(alice, "No date, newer");
    await add(alice, "Due soon", "2026-10-10");
    const done = await add(alice, "Done, due soonest", "2026-01-01");
    await updateTodo(alice, done.id, { done: true });

    const titles = (await listTodos(alice, { status: "all" })).map(
      (t) => t.title,
    );
    expect(titles).toEqual([
      "Due soon",
      "Due later",
      "No date, newer",
      "No date, older",
      "Done, due soonest",
    ]);
  });

  test("sorts the way compareTodos does, which the list on / sorts its own rows by", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const days = ["01", "02", "03", "04"];
    for (const [i, day] of days.entries()) {
      vi.setSystemTime(new Date(`2026-10-${day}T09:00:00Z`));
      await add(alice, `Undated ${day}`);
      await add(alice, `Due ${day}`, `2026-11-${days.at(-1 - i)}`);
      const done = await add(alice, `Done ${day}`, i % 2 ? null : "2026-10-20");
      await updateTodo(alice, done.id, { done: true });
    }
    const listed = await listTodos(alice, { status: "all" });
    expect([...listed].reverse().sort(compareTodos)).toEqual(listed);
  });
});

describe("getTodo", () => {
  test("another user's todo is not found, like an unknown id", async () => {
    const todo = await add(alice, "Secret");
    await expect(getTodo(bob, todo.id)).rejects.toBeInstanceOf(
      TodoNotFoundError,
    );
    await expect(getTodo(alice, "no-such-id")).rejects.toMatchObject(notFound);
  });
});

describe("updateTodo", () => {
  test("changes only the given fields", async () => {
    const todo = await add(alice, "Buy tuna", "2026-10-31");
    const renamed = await updateTodo(alice, todo.id, { title: "Buy salmon" });
    expect(renamed).toEqual({ ...todo, title: "Buy salmon" });
    const undated = await updateTodo(alice, todo.id, { dueDate: null });
    expect(undated).toEqual({ ...renamed, dueDate: null });
    expect(await updateTodo(alice, todo.id, {})).toEqual(undated);
  });

  test("done sets completedAt, done again keeps it, reopening clears it", async () => {
    const todo = await add(alice, "Nap");
    const done = await updateTodo(alice, todo.id, { done: true });
    expect(done.done).toBe(true);
    expect(done.completedAt).not.toBeNull();
    expect(Date.parse(done.completedAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(todo.createdAt),
    );

    const again = await updateTodo(alice, todo.id, {
      done: true,
      title: "Nap!",
    });
    expect(again.completedAt).toBe(done.completedAt);

    const reopened = await updateTodo(alice, todo.id, { done: false });
    expect(reopened).toMatchObject({ done: false, completedAt: null });
  });

  test("another user's todo is not found and stays unchanged", async () => {
    const todo = await add(alice, "Mine");
    await expect(
      updateTodo(bob, todo.id, { title: "Hijacked", done: true }),
    ).rejects.toMatchObject(notFound);
    await expect(updateTodo(bob, todo.id, {})).rejects.toMatchObject(notFound);
    expect(await getTodo(alice, todo.id)).toEqual(todo);
  });
});

describe("deleteTodo", () => {
  test("deletes the user's own todo", async () => {
    const todo = await add(alice, "Gone soon");
    await deleteTodo(alice, todo.id);
    await expect(getTodo(alice, todo.id)).rejects.toMatchObject(notFound);
    await expect(deleteTodo(alice, todo.id)).rejects.toMatchObject(notFound);
  });

  test("another user's todo is not found and stays", async () => {
    const todo = await add(alice, "Mine");
    await expect(deleteTodo(bob, todo.id)).rejects.toMatchObject(notFound);
    expect(await getTodo(alice, todo.id)).toEqual(todo);
  });
});

describe("replaceTodos", () => {
  test("replaces only the user's own todos", async () => {
    await add(alice, "Old");
    const bobs = await add(bob, "Bob's");
    const createdAt = new Date("2026-09-20T09:00:00Z");
    const completedAt = new Date("2026-09-21T10:00:00Z");

    const seeded = await replaceTodos(alice, [
      { title: "Open", dueDate: "2026-10-01", createdAt, completedAt: null },
      { title: "Done", dueDate: null, createdAt, completedAt },
    ]);

    expect(await listTodos(alice, { status: "all" })).toEqual(seeded);
    expect(seeded).toMatchObject([
      { title: "Open", done: false, createdAt: createdAt.toISOString() },
      { title: "Done", done: true, completedAt: completedAt.toISOString() },
    ]);
    expect(await listTodos(bob, { status: "all" })).toEqual([bobs]);
  });
});

test("deleting a user deletes their todos, and only theirs", async () => {
  await add(alice, "Alice's");
  const bobs = await add(bob, "Bob's");
  await db.delete(user).where(eq(user.id, alice));
  expect(await db.select().from(todos).where(eq(todos.userId, alice))).toEqual(
    [],
  );
  expect(await listTodos(bob, { status: "all" })).toEqual([bobs]);
});
