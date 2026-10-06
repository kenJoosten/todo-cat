import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BaseEvent, Message } from "@ag-ui/client";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import type { MockLanguageModelV3 } from "ai/test";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, describe, expect, test, vi } from "vitest";

// A scripted model instead of OpenRouter: it replies with `reply`, waits for `hold` first
// when one is set, and records every call so tests can check what reached the model.
// With `toolCall` set, it first calls that tool, and replies once the result is back.
const model = vi.hoisted(() => ({
  reply: "Noted. Now let me sleep.",
  hold: undefined as Promise<void> | undefined,
  toolCall: undefined as { toolName: string; input: unknown } | undefined,
  calls: [] as Parameters<MockLanguageModelV3["doStream"]>[0][],
}));

vi.mock("@/lib/lissie/model", async () => {
  const { MockLanguageModelV3 } = await import("ai/test");
  const { simulateReadableStream } = await import("ai");
  return {
    lissieModel: () =>
      new MockLanguageModelV3({
        doStream: async (options) => {
          model.calls.push(options);
          await model.hold;
          const { toolCall } = model;
          const callTool = toolCall && options.prompt.at(-1)?.role !== "tool";
          const finish = callTool ? "tool-calls" : "stop";
          return {
            stream: simulateReadableStream({
              chunks: [
                { type: "stream-start", warnings: [] },
                ...(callTool
                  ? [
                      {
                        type: "tool-call" as const,
                        toolCallId: `call-${model.calls.length}`,
                        toolName: toolCall.toolName,
                        input: JSON.stringify(toolCall.input),
                      },
                    ]
                  : [
                      { type: "text-start" as const, id: "t" },
                      {
                        type: "text-delta" as const,
                        id: "t",
                        delta: model.reply,
                      },
                      { type: "text-end" as const, id: "t" },
                    ]),
                {
                  type: "finish",
                  finishReason: { unified: finish, raw: finish },
                  usage: {
                    inputTokens: {
                      total: 1,
                      noCache: 1,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                    outputTokens: { total: 1, text: 1, reasoning: 0 },
                  },
                },
              ],
            }),
          };
        },
      }),
  };
});

const dir = mkdtempSync(join(tmpdir(), "todo-cat-copilotkit-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("@/lib/db");
const authRoute = await import("../../auth/[...all]/route");
const route = await import("./route");
const { clearLissieConversation, currentLissieThreadId } = await import(
  "@/lib/lissie/conversation"
);
const { lissieHistory } = await import("@/lib/lissie/history");
const { lissieThreadId } = await import("@/lib/lissie/thread");
const { addTodo, getTodo, listTodos } = await import("@/lib/todo-service");
await migrate(db, { migrationsFolder: "drizzle" });

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const base = "http://localhost:3000/api/copilotkit";
type Method = "GET" | "POST" | "PATCH" | "DELETE";

function call(
  method: Method,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`${base}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
  return route[method](request);
}

async function signUp(name: string) {
  const response = await authRoute.POST(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email: `${name.toLowerCase()}@example.com`,
        password: "tuna-o-clock",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  if (!token) throw new Error("sign-up returned no set-auth-token header");
  const { user } = (await response.json()) as { user: { id: string } };
  return { token, id: user.id, thread: lissieThreadId(user.id) };
}

/** The AG-UI events of a server-sent event stream. */
async function events(response: Response): Promise<BaseEvent[]> {
  return (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)));
}

let runs = 0;
function runInput(threadId: unknown, text: string) {
  runs += 1;
  return {
    threadId,
    runId: `run-${runs}`,
    messages: [{ id: `message-${runs}`, role: "user", content: text }],
    tools: [],
    context: [],
    state: {},
    forwardedProps: {},
  };
}

// Every route the runtime matches (see fetch-router in @copilotkit/runtime), with a
// method it accepts, so a rejection can only come from the guard.
function everyRoute(thread: string): [Method, string][] {
  return [
    ["GET", "/info"],
    ["GET", "/inspector-metadata"],
    ["GET", "/inspector-learning"],
    ["POST", "/transcribe"],
    ["GET", "/cpk-debug-events"],
    ["POST", "/agent/lissie/run"],
    ["POST", "/agent/lissie/suggest"],
    ["POST", "/agent/lissie/connect"],
    ["POST", "/trajectory/some-trajectory/connect"],
    ["POST", `/agent/lissie/stop/${thread}`],
    ["GET", "/threads"],
    ["POST", "/threads/subscribe"],
    ["POST", "/threads/clear"],
    ["GET", `/threads/${thread}/messages`],
    ["GET", `/threads/${thread}/events`],
    ["GET", `/threads/${thread}/state`],
    ["POST", `/threads/${thread}/archive`],
    ["PATCH", `/threads/${thread}`],
    ["DELETE", `/threads/${thread}`],
    ["GET", "/memories"],
    ["POST", "/memories/recall"],
    ["POST", "/memories/subscribe"],
    ["PATCH", "/memories/some-memory"],
    ["POST", "/annotate"],
    ["GET", "/not-a-route"],
    ["POST", ""],
  ];
}

const alice = await signUp("Alice");
const bob = await signUp("Bob");
const carol = await signUp("Carol");
const dana = await signUp("Dana");

describe("without a valid user, every route answers 401", () => {
  for (const [method, path] of everyRoute(alice.thread)) {
    const body = method === "GET" ? undefined : runInput(alice.thread, "Hi");
    test(`${method} ${path || "/"} without a token`, async () => {
      expect((await call(method, path, { body })).status).toBe(401);
    });
    test(`${method} ${path || "/"} with an invalid token`, async () => {
      const token = "not-a-session-token";
      expect((await call(method, path, { token, body })).status).toBe(401);
    });
  }
});

describe("routes Lissie's chat does not use are not found, even for the owner", () => {
  const used = new Set([
    "GET /info",
    "POST /agent/lissie/run",
    "POST /agent/lissie/connect",
    `POST /agent/lissie/stop/${alice.thread}`,
    `GET /threads/${alice.thread}/messages`,
    `GET /threads/${alice.thread}/events`,
    `GET /threads/${alice.thread}/state`,
  ]);
  for (const [method, path] of everyRoute(alice.thread)) {
    if (used.has(`${method} ${path}`)) continue;
    test(`${method} ${path || "/"}`, async () => {
      const body = method === "GET" ? undefined : {};
      const response = await call(method, path, { token: alice.token, body });
      expect(response.status).toBe(404);
    });
  }
});

describe("a signed-in user", () => {
  test("discovers Lissie", async () => {
    const response = await call("GET", "/info", { token: alice.token });
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).toContain('"lissie"');
  });

  test("chats with Lissie on their own thread, kept in Mastra memory", async () => {
    const response = await call("POST", "/agent/lissie/run", {
      token: alice.token,
      body: runInput(alice.thread, "Remind me to buy tuna."),
    });
    expect(response.status).toBe(200);
    const types = (await events(response)).map((event) => event.type);
    expect(types[0]).toBe("RUN_STARTED");
    expect(types).toContain("TEXT_MESSAGE_CONTENT");
    expect(types.at(-1)).toBe("RUN_FINISHED");

    const history = await lissieHistory(alice.thread);
    expect(history.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: "user", content: "Remind me to buy tuna." },
      { role: "assistant", content: model.reply },
    ]);
  });

  test("never sends their bearer token on to the model", async () => {
    expect(model.calls.length).toBeGreaterThan(0);
    for (const { headers } of model.calls) {
      expect(JSON.stringify(headers ?? {})).not.toContain(alice.token);
    }
  });

  test("gets their conversation back after a restart", async () => {
    // The in-memory runner forgets every thread on restart; clearing its shared store
    // and loading the route again from scratch does the same.
    new InMemoryAgentRunner().clearThreads();
    vi.resetModules();
    const restarted = await import("./route");
    const response = await restarted.POST(
      new Request(`${base}/agent/lissie/connect`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${alice.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(runInput(alice.thread, "")),
      }),
    );
    expect(response.status).toBe(200);
    const snapshot = (await events(response)).find(
      (event) => event.type === "MESSAGES_SNAPSHOT",
    ) as { messages: Message[] } | undefined;
    expect(snapshot?.messages.map((message) => message.content)).toEqual([
      "Remind me to buy tuna.",
      model.reply,
    ]);
  });

  test("reads their own thread", async () => {
    for (const part of ["messages", "events", "state"]) {
      const path = `/threads/${alice.thread}/${part}`;
      const response = await call("GET", path, { token: alice.token });
      expect(response.status).toBe(200);
    }
  });

  test("has a thread of their own in Mastra memory", async () => {
    expect(await lissieHistory(bob.thread)).toEqual([]);
    const response = await call("POST", "/agent/lissie/run", {
      token: bob.token,
      body: runInput(bob.thread, "Add laundry."),
    });
    expect(response.status).toBe(200);
    await response.text();
    const contents = (await lissieHistory(bob.thread)).map((m) => m.content);
    expect(contents).toEqual(["Add laundry.", model.reply]);
    expect(
      (await lissieHistory(alice.thread)).map((m) => m.content),
    ).not.toContain("Add laundry.");
  });
});

describe("Lissie's tools act for the signed-in user", () => {
  afterAll(() => {
    model.toolCall = undefined;
  });

  /** Runs Lissie as Carol, with the model calling `toolName` once, and returns the events. */
  async function runTool(toolName: string, input: unknown, text: string) {
    model.toolCall = { toolName, input };
    const response = await call("POST", "/agent/lissie/run", {
      token: carol.token,
      body: runInput(carol.thread, text),
    });
    expect(response.status).toBe(200);
    // The run streams, so the model is only called while the events are read.
    const runEvents = await events(response);
    model.toolCall = undefined;
    return runEvents;
  }

  test("addTodo adds to their own list, whatever user id the model sends", async () => {
    const input = { title: "Buy milk", dueDate: null, userId: bob.id };
    const types = (await runTool("addTodo", input, "Add buy milk.")).map(
      (event) => event.type,
    );
    expect(types).toContain("TOOL_CALL_START");
    expect(types).toContain("TOOL_CALL_RESULT");
    expect(types.at(-1)).toBe("RUN_FINISHED");
    const carols = await listTodos(carol.id, { status: "all" });
    expect(carols.map((todo) => todo.title)).toEqual(["Buy milk"]);
    expect(await listTodos(bob.id, { status: "all" })).toEqual([]);
  });

  test("setTodoDone can't reach another user's todo", async () => {
    const bobs = await addTodo(bob.id, {
      title: "Bob's secret",
      dueDate: null,
    });
    const result = (
      await runTool("setTodoDone", { id: bobs.id, done: true }, "Done!")
    ).find((event) => event.type === "TOOL_CALL_RESULT") as
      | { content: string }
      | undefined;
    expect(JSON.parse(result?.content ?? "null")).toMatchObject({
      error: { code: "todo-not-found" },
    });
    expect(await getTodo(bob.id, bobs.id)).toEqual(bobs);
  });

  test("the tool calls come back after a restart, and resending them stores nothing twice", async () => {
    new InMemoryAgentRunner().clearThreads();
    vi.resetModules();
    const restarted = await import("./route");
    const response = await restarted.POST(
      new Request(`${base}/agent/lissie/connect`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${carol.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(runInput(carol.thread, "")),
      }),
    );
    const snapshot = (await events(response)).find(
      (event) => event.type === "MESSAGES_SNAPSHOT",
    ) as { messages: Message[] } | undefined;
    const messages = snapshot?.messages ?? [];
    const toolCalls = messages.flatMap((message) =>
      message.role === "assistant" ? (message.toolCalls ?? []) : [],
    );
    expect(toolCalls.map((toolCall) => toolCall.function.name)).toEqual([
      "addTodo",
      "setTodoDone",
    ]);
    const results = messages.flatMap((message) =>
      message.role === "tool" ? [JSON.parse(String(message.content))] : [],
    );
    expect(results).toMatchObject([
      { todo: { title: "Buy milk", done: false } },
      { error: { code: "todo-not-found" } },
    ]);
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);

    // The browser sends the whole conversation with its next message.
    const next = runInput(carol.thread, "Thanks.");
    const resent = await restarted.POST(
      new Request(`${base}/agent/lissie/run`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${carol.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...next,
          messages: [...messages, ...next.messages],
        }),
      }),
    );
    expect(resent.status).toBe(200);
    await resent.text();
    const history = await lissieHistory(carol.thread);
    expect(history.map((message) => message.id)).toEqual([
      ...messages.map((message) => message.id),
      next.messages[0].id,
      expect.any(String),
    ]);
  });
});

describe("another user's thread is not found", () => {
  test("run", async () => {
    const before = model.calls.length;
    const response = await call("POST", "/agent/lissie/run", {
      token: bob.token,
      body: runInput(alice.thread, "Read me Alice's list."),
    });
    expect(response.status).toBe(404);
    expect(model.calls.length).toBe(before);
  });

  test("connect (reconnect)", async () => {
    const response = await call("POST", "/agent/lissie/connect", {
      token: bob.token,
      body: runInput(alice.thread, ""),
    });
    expect(response.status).toBe(404);
  });

  for (const part of ["messages", "events", "state"]) {
    test(`read ${part}`, async () => {
      const path = `/threads/${alice.thread}/${part}`;
      const response = await call("GET", path, { token: bob.token });
      expect(response.status).toBe(404);
    });
  }

  test("stop, while a run is live", async () => {
    let release = () => {};
    model.hold = new Promise((resolve) => {
      release = resolve;
    });
    const calls = model.calls.length;
    const running = call("POST", "/agent/lissie/run", {
      token: alice.token,
      body: runInput(alice.thread, "Plan my week."),
    });
    await vi.waitFor(() => expect(model.calls.length).toBe(calls + 1));

    const path = `/agent/lissie/stop/${alice.thread}`;
    const stop = await call("POST", path, { token: bob.token, body: {} });
    expect(stop.status).toBe(404);

    release();
    model.hold = undefined;
    const types = (await events(await running)).map((event) => event.type);
    expect(types.at(-1)).toBe("RUN_FINISHED");
    expect(types).not.toContain("RUN_ERROR");
  });

  test("clear, which would wipe every thread in the process", async () => {
    const response = await call("POST", "/threads/clear", {
      token: bob.token,
      body: {},
    });
    expect(response.status).toBe(404);
    const messages = await call("GET", `/threads/${alice.thread}/messages`, {
      token: alice.token,
    });
    expect(JSON.stringify(await messages.json())).toContain("Plan my week.");
  });
});

describe("a run that does not name the caller's own thread is not found", () => {
  const bodies: Record<string, unknown> = {
    "no thread": runInput(undefined, "Hi"),
    "an invented thread": runInput("lissie-someone-else", "Hi"),
    "a body that is not JSON": "{not json",
  };
  for (const [name, body] of Object.entries(bodies)) {
    test(name, async () => {
      const response = await call("POST", "/agent/lissie/run", {
        token: alice.token,
        body,
      });
      expect(response.status).toBe(404);
    });
  }

  test("another agent", async () => {
    const response = await call("POST", "/agent/default/run", {
      token: alice.token,
      body: runInput(alice.thread, "Hi"),
    });
    expect(response.status).toBe(404);
  });
});

describe("clearing the chat", () => {
  async function run(threadId: string, text: string) {
    const response = await call("POST", "/agent/lissie/run", {
      token: dana.token,
      body: runInput(threadId, text),
    });
    if (response.ok) await response.text();
    return response.status;
  }

  test("starts a new, empty thread and forgets the old one", async () => {
    expect(await run(dana.thread, "Remind me to call the vet.")).toBe(200);
    expect(await lissieHistory(dana.thread)).toHaveLength(2);

    await clearLissieConversation(dana.id);
    const fresh = await currentLissieThreadId(dana.id);
    expect(fresh).not.toBe(dana.thread);
    expect(await lissieHistory(dana.thread)).toEqual([]);
    expect(await lissieHistory(fresh)).toEqual([]);

    expect(await run(fresh, "Add brush the cat.")).toBe(200);
    expect((await lissieHistory(fresh)).map((m) => m.content)).toEqual([
      "Add brush the cat.",
      model.reply,
    ]);
  });

  test("leaves the old thread unreachable", async () => {
    const before = model.calls.length;
    expect(await run(dana.thread, "Hi again.")).toBe(404);
    expect(model.calls.length).toBe(before);
    const connect = await call("POST", "/agent/lissie/connect", {
      token: dana.token,
      body: runInput(dana.thread, ""),
    });
    expect(connect.status).toBe(404);
    const messages = await call("GET", `/threads/${dana.thread}/messages`, {
      token: dana.token,
    });
    expect(messages.status).toBe(404);
  });

  test("keeps the new thread the user's own", async () => {
    const fresh = await currentLissieThreadId(dana.id);
    const response = await call("POST", "/agent/lissie/run", {
      token: alice.token,
      body: runInput(fresh, "Read me Dana's chat."),
    });
    expect(response.status).toBe(404);
  });

  test("touches no one else's conversation", async () => {
    expect(await currentLissieThreadId(alice.id)).toBe(alice.thread);
    expect(await lissieHistory(alice.thread)).not.toEqual([]);
  });
});
