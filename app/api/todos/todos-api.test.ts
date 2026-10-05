import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ErrorCode,
  errorBodySchema,
  todoListSchema,
  todoSchema,
} from "@todo-cat/contract";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, describe, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-api-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("@/lib/db");
const authRoute = await import("../auth/[...all]/route");
const todosRoute = await import("./route");
const todoRoute = await import("./[id]/route");
await migrate(db, { migrationsFolder: "drizzle" });

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const base = "http://localhost:3000";

type Call = {
  token?: string;
  query?: string;
  body?: unknown;
  rawBody?: string;
};

function request(method: string, path: string, call: Call = {}) {
  const headers = new Headers();
  if (call.token) headers.set("authorization", `Bearer ${call.token}`);
  const body =
    call.rawBody ??
    (call.body === undefined ? undefined : JSON.stringify(call.body));
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${base}${path}${call.query ?? ""}`, {
    method,
    headers,
    body,
  });
}

// One function per endpoint, each calling its route handler the way Next does.
const endpoints = {
  "GET /api/todos": (call?: Call) =>
    todosRoute.GET(request("GET", "/api/todos", call)),
  "POST /api/todos": (call?: Call) =>
    todosRoute.POST(request("POST", "/api/todos", call)),
  "GET /api/todos/:id": (id: string, call?: Call) =>
    todoRoute.GET(request("GET", `/api/todos/${id}`, call), {
      params: Promise.resolve({ id }),
    }),
  "PATCH /api/todos/:id": (id: string, call?: Call) =>
    todoRoute.PATCH(request("PATCH", `/api/todos/${id}`, call), {
      params: Promise.resolve({ id }),
    }),
  "DELETE /api/todos/:id": (id: string, call?: Call) =>
    todoRoute.DELETE(request("DELETE", `/api/todos/${id}`, call), {
      params: Promise.resolve({ id }),
    }),
};
const list = endpoints["GET /api/todos"];
const add = endpoints["POST /api/todos"];
const get = endpoints["GET /api/todos/:id"];
const update = endpoints["PATCH /api/todos/:id"];
const remove = endpoints["DELETE /api/todos/:id"];

/** Signs up through Better Auth's endpoint, like curl would, and returns the bearer token. */
async function signUp(name: string) {
  const response = await authRoute.POST(
    request("POST", "/api/auth/sign-up/email", {
      body: {
        name,
        email: `${name.toLowerCase()}@example.com`,
        password: "tuna-o-clock",
      },
    }),
  );
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  if (!token) throw new Error("sign-up returned no set-auth-token header");
  return token;
}

async function expectError(
  response: Response,
  status: number,
  code: ErrorCode,
) {
  expect(response.status).toBe(status);
  const body = errorBodySchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  return body.error.message;
}

describe("without a valid user, every endpoint answers 401", () => {
  // Valid input, so only the missing user can explain the 401.
  const calls = {
    "GET /api/todos": (call: Call) => list(call),
    "POST /api/todos": (call: Call) => add({ ...call, body: { title: "Nap" } }),
    "GET /api/todos/:id": (call: Call) => get("some-id", call),
    "PATCH /api/todos/:id": (call: Call) =>
      update("some-id", { ...call, body: { done: true } }),
    "DELETE /api/todos/:id": (call: Call) => remove("some-id", call),
  };

  for (const [endpoint, call] of Object.entries(calls)) {
    test(`${endpoint} without a token`, async () => {
      await expectError(await call({}), 401, "unauthorized");
    });

    test(`${endpoint} with an invalid token`, async () => {
      await expectError(
        await call({ token: "not-a-session-token" }),
        401,
        "unauthorized",
      );
    });
  }
});

const token = await signUp("Alice");
const bobToken = await signUp("Bob");

describe("with a bearer token", () => {
  test("adds, lists, completes, filters, and deletes a todo", async () => {
    const added = await add({
      token,
      body: { title: "  Buy tuna ", dueDate: "2026-10-31" },
    });
    expect(added.status).toBe(201);
    const todo = todoSchema.parse(await added.json());
    expect(todo).toMatchObject({
      title: "Buy tuna",
      dueDate: "2026-10-31",
      done: false,
    });

    const listed = await list({ token });
    expect(listed.status).toBe(200);
    expect(todoListSchema.parse(await listed.json())).toEqual([todo]);

    const completed = await update(todo.id, { token, body: { done: true } });
    expect(completed.status).toBe(200);
    const done = todoSchema.parse(await completed.json());
    expect(done.done).toBe(true);
    expect(done.completedAt).not.toBeNull();

    const titles = async (query: string) =>
      todoListSchema
        .parse(await (await list({ token, query })).json())
        .map((t) => t.title);
    expect(await titles("")).toEqual([]);
    expect(await titles("?status=open")).toEqual([]);
    expect(await titles("?status=done")).toEqual(["Buy tuna"]);
    expect(await titles("?status=all&q=TUNA")).toEqual(["Buy tuna"]);
    expect(await titles("?status=all&q=salmon")).toEqual([]);

    const fetched = await get(todo.id, { token });
    expect(todoSchema.parse(await fetched.json())).toEqual(done);

    const deleted = await remove(todo.id, { token });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
    await expectError(await get(todo.id, { token }), 404, "todo-not-found");
    await expectError(await remove(todo.id, { token }), 404, "todo-not-found");
  });

  test("another user's todo id gives 404 and leaves the todo alone", async () => {
    const todo = todoSchema.parse(
      await (await add({ token, body: { title: "Alice's secret" } })).json(),
    );

    await expectError(
      await get(todo.id, { token: bobToken }),
      404,
      "todo-not-found",
    );
    await expectError(
      await update(todo.id, { token: bobToken, body: { title: "Bob's now" } }),
      404,
      "todo-not-found",
    );
    await expectError(
      await remove(todo.id, { token: bobToken }),
      404,
      "todo-not-found",
    );
    expect(
      todoListSchema.parse(
        await (await list({ token: bobToken, query: "?status=all" })).json(),
      ),
    ).toEqual([]);
    expect(
      todoSchema.parse(await (await get(todo.id, { token })).json()),
    ).toEqual(todo);
  });

  test("invalid input gives 400 validation-failed", async () => {
    const todo = todoSchema.parse(
      await (await add({ token, body: { title: "Valid" } })).json(),
    );

    const blank = await expectError(
      await add({ token, body: { title: "   " } }),
      400,
      "validation-failed",
    );
    expect(blank).toContain("title");
    await expectError(
      await add({ token, body: { title: "Vet", dueDate: "2026-02-30" } }),
      400,
      "validation-failed",
    );
    await expectError(
      await add({ token, rawBody: "{not json" }),
      400,
      "validation-failed",
    );
    await expectError(await add({ token }), 400, "validation-failed");
    await expectError(
      await update(todo.id, { token, body: { done: "yes" } }),
      400,
      "validation-failed",
    );
    await expectError(
      await list({ token, query: "?status=later" }),
      400,
      "validation-failed",
    );
  });
});
