import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-seed-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("../lib/db");
const { auth } = await import("../lib/auth");
const { user } = await import("../lib/schema");
const { listTodos } = await import("../lib/todo-service");
const { demoUser, seedDemo } = await import("./demo-seed");
await migrate(db, { migrationsFolder: "drizzle" });

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const today = new Date(2026, 9, 5, 14, 30);
// Ids are new on every run; everything else must match.
const withoutIds = <T extends { id: string; title: string }>(todos: T[]) =>
  todos
    .map(({ id: _, ...todo }) => todo)
    .sort((a, b) => a.title.localeCompare(b.title));

test("seeding twice gives the same demo user and todos", async () => {
  const first = await seedDemo(today);
  const second = await seedDemo(today);

  expect(second.userId).toBe(first.userId);
  expect(await db.select().from(user)).toHaveLength(1);
  expect(withoutIds(second.todos)).toEqual(withoutIds(first.todos));
  const stored = await listTodos(first.userId, { status: "all" });
  expect(withoutIds(stored)).toEqual(withoutIds(first.todos));
});

test("the demo todos span two weeks, some done, some due", async () => {
  const { todos } = await seedDemo(today);
  expect(todos.length).toBeGreaterThanOrEqual(10);
  expect(todos.some((t) => t.done)).toBe(true);
  expect(todos.some((t) => !t.done)).toBe(true);
  expect(todos.some((t) => t.dueDate)).toBe(true);
  const created = todos.map((t) => Date.parse(t.createdAt));
  const twoWeeksAgo = new Date(2026, 8, 21).getTime();
  expect(Math.min(...created)).toBeGreaterThanOrEqual(twoWeeksAgo);
  expect(Math.max(...created)).toBeLessThan(today.getTime());
});

test("the demo user signs in with the documented password", async () => {
  const result = await auth.api.signInEmail({
    body: { email: demoUser.email, password: demoUser.password },
  });
  expect(result.user.email).toBe(demoUser.email);
});
