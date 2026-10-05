import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-db-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
const { db } = await import("./db");

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

// drizzle-kit writes one folder per migration; a missing folder means no migrations yet.
function migrationCount() {
  try {
    return readdirSync("drizzle", { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    ).length;
  } catch {
    return 0;
  }
}

test("every migration applies to a fresh database file", async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  const applied = await db.all(sql`select name from __drizzle_migrations`);
  expect(applied).toHaveLength(migrationCount());
});

test("the connection runs queries", async () => {
  expect(await db.get(sql`select 1 + 1 as two`)).toEqual({ two: 2 });
});
