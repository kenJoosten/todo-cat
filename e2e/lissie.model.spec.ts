import { expect, test } from "@playwright/test";

// Calls the real model through OpenRouter, so it needs OPENROUTER_API_KEY in .env and runs
// only through `npm run test:e2e:model`, never in QA or CI. Model replies vary, so it
// checks that Lissie answers and that the conversation survives a reload, not her words.
test.setTimeout(120_000);

test("chat with Lissie, then find the conversation again after a reload", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Noor");
  await page.getByLabel("Email").fill(`noor-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Back to it, Noor." }),
  ).toBeVisible();

  const input = page.getByPlaceholder("Tell Lissie about your list");
  const message = "I keep putting off my tax return. Where do I start?";
  await input.fill(message);
  const run = page.waitForResponse((response) =>
    response.url().endsWith("/agent/lissie/run"),
  );
  await page.getByTestId("copilot-send-button").click();
  // The run's event stream ends when Lissie has finished her reply.
  await (await run).finished();

  await expect(page.getByText(message)).toBeVisible();
  const reply = page.getByTestId("copilot-assistant-message").last();
  await expect(reply).toHaveText(/\w{3,}/);
  const replyText = (await reply.innerText()).trim();

  await page.reload();
  await expect(page.getByText(message)).toBeVisible();
  await expect(
    page
      .getByTestId("copilot-assistant-message")
      .filter({ hasText: replyText.slice(0, 40) }),
  ).toBeVisible();
});
