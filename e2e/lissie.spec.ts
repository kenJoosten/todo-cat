import { createClient } from "@libsql/client";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { expect, type Page, test } from "@playwright/test";
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

/** Writes a past conversation into the e2e server's Mastra memory, as a run would. */
async function rememberConversation(email: string, texts: [string, string]) {
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
    await memory.saveMessages({
      messages: texts.map((text, index) => ({
        id: `remembered-${now}-${index}`,
        role: index === 0 ? "user" : "assistant",
        createdAt: new Date(now + index),
        threadId,
        resourceId,
        content: { format: 2, parts: [{ type: "text", text }] },
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
