import { createClient } from "@libsql/client";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { expect, type Page, test } from "@playwright/test";
import { progressCard } from "../lib/lissie/progress-card";
import { lissieThreadId } from "../lib/lissie/thread";

// Runs in QA and CI, so it never sends a message: that would call the model.
// lissie.model.spec.ts has a real conversation.

async function signUp(page: Page, name: string) {
  // Retries reuse the run's database, so the email must be unique per attempt.
  const email = `${name.toLowerCase()}-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: `Hi, ${name}.` }),
  ).toBeVisible();
  return email;
}

type Part =
  | { type: "text"; text: string }
  | {
      type: "tool-invocation";
      toolInvocation: {
        state: "result";
        toolCallId: string;
        toolName: string;
        args: unknown;
        result: unknown;
      };
    };

/**
 * Writes a past conversation into the e2e server's Mastra memory, as a run would: the
 * user's text, then Lissie's message as parts (text, or the tool calls she made).
 */
async function rememberConversation(
  email: string,
  [question, answer]: [string, string | Part[]],
) {
  const client = createClient({ url: String(process.env.E2E_DATABASE_URL) });
  try {
    const { rows } = await client.execute({
      sql: `select id from "user" where email = ?`,
      args: [email],
    });
    const resourceId = String(rows[0]?.id);
    const threadId = lissieThreadId(resourceId);
    const storage = new LibSQLStore({ id: "e2e", client });
    await storage.init();
    const memory = new Memory({ storage });
    const now = Date.now();
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: "",
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    });
    const parts: Part[][] = [
      [{ type: "text", text: question }],
      typeof answer === "string" ? [{ type: "text", text: answer }] : answer,
    ];
    await memory.saveMessages({
      messages: parts.map((messageParts, index) => ({
        id: `remembered-${now}-${index}`,
        role: index === 0 ? "user" : "assistant",
        createdAt: new Date(now + index),
        threadId,
        resourceId,
        content: { format: 2, parts: messageParts },
      })),
    });
  } finally {
    client.close();
  }
}

test("the chat with Lissie loads on / without errors or rejected runtime calls", async ({
  page,
}) => {
  const rejected: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().includes("/api/copilotkit") &&
      response.status() >= 400
    ) {
      rejected.push(`${response.status()} ${response.url()}`);
    }
  });

  await signUp(page, "Mila");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(
    page.getByPlaceholder("Tell Lissie about your list"),
  ).toBeVisible();
  // Discovery and the history replay have happened once the network is quiet.
  await page.waitForLoadState("networkidle");
  expect(rejected).toEqual([]);
  expect(errors).toEqual([]);
});

test("the chat shows the conversation kept in Mastra memory", async ({
  page,
}) => {
  const email = await signUp(page, "Ravi");
  const question = "Should I do the dishes or the laundry first?";
  const answer = "The dishes. The laundry can wait; I am sleeping on it.";
  await rememberConversation(email, [question, answer]);

  await page.reload();
  await expect(page.getByText(question)).toBeVisible();
  await expect(page.getByText(answer)).toBeVisible();
});

test("the list shows todos that changed outside the page, such as through the API", async ({
  page,
}) => {
  await signUp(page, "Ines");
  const list = page.getByRole("region", { name: "Your list" });
  await expect(list.getByText("Nothing open.")).toBeVisible();

  // The REST API, with the page's session cookie, stands in for another client.
  const add = (title: string, dueDate: string | null = null) =>
    page.request.post("/api/todos", { data: { title, dueDate } });
  await add("Buy tuna", "2031-10-09");
  const fed = await (await add("Feed the cat")).json();
  await page.request.patch(`/api/todos/${fed.id}`, { data: { done: true } });

  await page.reload();
  const open = list.getByRole("region", { name: /^Open/ });
  const done = list.getByRole("region", { name: /^Done/ });
  await expect(open.getByRole("listitem")).toHaveText([/^Buy tuna\s*9 Oct/]);
  await expect(
    done.getByRole("checkbox", { name: "Feed the cat" }),
  ).toBeChecked();
});

test("the replayed chat shows Lissie's tool calls as readable lines", async ({
  page,
}) => {
  const email = await signUp(page, "Jun");
  const todo = {
    id: "t1",
    title: "Buy milk",
    dueDate: null,
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  const reply = "Milk. For you, presumably. Noted.";
  await rememberConversation(email, [
    "Add buy milk.",
    [
      {
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          toolCallId: "call-1",
          toolName: "addTodo",
          args: { title: "Buy milk", dueDate: null },
          result: { todo },
        },
      },
      { type: "text", text: reply },
    ],
  ]);

  await page.reload();
  await expect(page.getByText("Added “Buy milk”")).toBeVisible();
  await expect(page.getByText(reply)).toBeVisible();
  await expect(page.getByText('"todo"')).toHaveCount(0);
});

test("the replayed chat shows Lissie's progress card, drawn from her catalog", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const email = await signUp(page, "Ada");
  await rememberConversation(email, [
    "How am I doing?",
    [
      {
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          toolCallId: "call-1",
          toolName: "showProgress",
          args: {},
          result: progressCard({ total: 4, done: 3, open: 1 }),
        },
      },
      { type: "text", text: "Three down. I watched, which counts as helping." },
    ],
  ]);

  await page.reload();
  await expect(page.getByText("Counted your todos")).toBeVisible();
  const bar = page.getByRole("progressbar", { name: "Todos done" });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuenow", "3");
  await expect(bar).toHaveAttribute("aria-valuemax", "4");
  await expect(page.getByText("3 of 4 done")).toBeVisible();
  await expect(page.getByText("1 still open")).toBeVisible();
  await expect(page.getByText("a2ui_operations")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("clearing the chat empties it, and Lissie forgets it after a reload", async ({
  page,
}) => {
  const email = await signUp(page, "Noor");
  const question = "Can the vacuuming wait until Saturday?";
  const answer = "It can. I would prefer it waited forever.";
  await rememberConversation(email, [question, answer]);
  await page.reload();
  await expect(page.getByText(answer)).toBeVisible();

  const clear = page.getByRole("button", { name: "Clear chat" });
  await clear.click();
  await expect(page.getByText("Lissie forgets it too.")).toBeVisible();
  await page.getByRole("button", { name: "Keep" }).click();
  await expect(clear).toBeFocused();
  await expect(page.getByText(answer)).toBeVisible();

  await clear.click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText(answer)).toHaveCount(0);
  await expect(page.getByText(question)).toHaveCount(0);
  await expect(clear).toBeDisabled();
  await expect(
    page.getByPlaceholder("Tell Lissie about your list"),
  ).toBeFocused();

  await page.reload();
  await expect(
    page.getByPlaceholder("Tell Lissie about your list"),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(question)).toHaveCount(0);
  await expect(clear).toBeDisabled();
});
