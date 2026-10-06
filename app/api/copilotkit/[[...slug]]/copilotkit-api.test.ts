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
const model = vi.hoisted(() => ({
  reply: "Noted. Now let me sleep.",
  hold: undefined as Promise<void> | undefined,
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
          return {
            stream: simulateReadableStream({
              chunks: [
                { type: "stream-start", warnings: [] },
                { type: "text-start", id: "t" },
                { type: "text-delta", id: "t", delta: model.reply },
                { type: "text-end", id: "t" },
                {
                  type: "finish",
                  finishReason: { unified: "stop", raw: "stop" },
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
const { lissieHistory } = await import("@/lib/lissie/history");
const { lissieThreadId } = await import("@/lib/lissie/thread");
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
