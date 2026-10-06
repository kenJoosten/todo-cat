import { describe, expect, test } from "vitest";
import {
  checkResponse,
  endpointById,
  type RequestInput,
  requestInit,
  requestPath,
  toCurl,
  todosIn,
} from "./requests";

const input: RequestInput = { todoId: "", status: "all", q: "", body: "" };

const todo = {
  id: "t1",
  title: "Buy tuna",
  dueDate: "2026-10-31",
  done: false,
  createdAt: "2026-10-05T10:00:00.000Z",
  completedAt: null,
};

describe("requestPath", () => {
  test("a list leaves out an empty q", () => {
    expect(requestPath(endpointById("list"), input)).toBe(
      "/api/todos?status=all",
    );
    expect(
      requestPath(endpointById("list"), { ...input, q: "tuna & milk" }),
    ).toBe("/api/todos?status=all&q=tuna+%26+milk");
  });

  test("an id is trimmed and encoded", () => {
    expect(
      requestPath(endpointById("get"), { ...input, todoId: " a/b " }),
    ).toBe("/api/todos/a%2Fb");
  });
});

describe("requestInit", () => {
  test("a bearer request omits cookies and sends the body as typed", () => {
    const init = requestInit(
      endpointById("create"),
      { ...input, body: "{not json" },
      { mode: "bearer", token: "abc.def" },
    );
    expect(init).toEqual({
      method: "POST",
      headers: {
        authorization: "Bearer abc.def",
        "content-type": "application/json",
      },
      body: "{not json",
      credentials: "omit",
    });
  });

  test("only cookie mode lets the browser send its cookie", () => {
    expect(
      requestInit(endpointById("list"), input, { mode: "cookie" }).credentials,
    ).toBe("same-origin");
    expect(
      requestInit(endpointById("list"), input, { mode: "none" }).headers,
    ).toEqual({});
  });
});

test("toCurl quotes values for the shell", () => {
  const curl = toCurl(
    "http://localhost:3000",
    endpointById("create"),
    { ...input, body: `{"title":"Lissie's tuna"}` },
    { mode: "bearer", token: "abc" },
  );
  expect(curl).toBe(
    [
      "curl -i",
      "-X POST",
      "'http://localhost:3000/api/todos'",
      "-H 'authorization: Bearer abc'",
      "-H 'content-type: application/json'",
      `-d '{"title":"Lissie'\\''s tuna"}'`,
    ].join(" \\\n  "),
  );
});

describe("checkResponse", () => {
  const error = (code: string) =>
    JSON.stringify({ error: { code, message: "Nope" } });

  test("a success body must match the endpoint's schema", () => {
    const list = endpointById("list");
    expect(checkResponse(list, 200, JSON.stringify([todo])).ok).toBe(true);
    const wrong = checkResponse(list, 200, JSON.stringify([{ id: 1 }]));
    expect(wrong.ok).toBe(false);
    expect(wrong.message).toContain("todoListSchema");
  });

  test("a delete must answer without a body", () => {
    expect(checkResponse(endpointById("delete"), 204, "").ok).toBe(true);
    expect(checkResponse(endpointById("delete"), 204, "{}").ok).toBe(false);
  });

  test("an error must carry the code its status maps to", () => {
    const get = endpointById("get");
    expect(checkResponse(get, 404, error("todo-not-found")).ok).toBe(true);
    expect(checkResponse(get, 404, error("unauthorized"))).toEqual({
      ok: false,
      message: "A 404 should carry code todo-not-found, not unauthorized",
    });
    expect(checkResponse(get, 404, "<html>").ok).toBe(false);
  });

  test("an undocumented status fails", () => {
    expect(
      checkResponse(endpointById("get"), 400, error("validation-failed")),
    ).toEqual({
      ok: false,
      message:
        "400 isn't documented for this endpoint, which answers 200, 401, 404",
    });
    expect(checkResponse(endpointById("list"), 500, "").ok).toBe(false);
  });
});

test("todosIn finds a list, a single todo, or nothing", () => {
  expect(todosIn(JSON.stringify([todo]))).toEqual([todo]);
  expect(todosIn(JSON.stringify(todo))).toEqual([todo]);
  expect(todosIn(JSON.stringify({ error: {} }))).toEqual([]);
  expect(todosIn("")).toEqual([]);
});
