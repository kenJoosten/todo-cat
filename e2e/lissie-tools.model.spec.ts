import { expect, test } from "@playwright/test";

// Calls the real model through OpenRouter, so it needs OPENROUTER_API_KEY in .env and runs
// only through `npm run test:e2e:model` (or `npm run test:e2e:model:tools` for this spec
// alone), never in QA or CI. Model replies vary, so it checks what Lissie did, not her words.
test.setTimeout(120_000);

test("ask Lissie to add buy milk, and find it on the list", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Oona");
  await page.getByLabel("Email").fill(`oona-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Back to it, Oona." }),
  ).toBeVisible();

  const open = page
    .getByRole("region", { name: "Your list" })
    .getByRole("region", { name: /^Open/ });
  await expect(open.getByText("An empty list.")).toBeVisible();

  await page
    .getByPlaceholder("Tell Lissie about your list")
    .fill('Please add "buy milk" to my list.');
  const run = page.waitForResponse((response) =>
    response.url().endsWith("/agent/lissie/run"),
  );
  await page.getByTestId("copilot-send-button").click();
  // The run's event stream ends when Lissie has finished her reply.
  await (await run).finished();

  // The list refreshes after her change, without a reload.
  await expect(
    open.getByRole("checkbox", { name: /^buy milk$/i }),
  ).toBeVisible();
  // Her tool call shows as one readable line, and she says something about it.
  await expect(page.getByText(/^Added “buy milk”$/i)).toBeVisible();
  await expect(page.getByTestId("copilot-assistant-message").last()).toHaveText(
    /\w{3,}/,
  );

  // Both survive a reload: the list from the database, the line from Mastra memory.
  await page.reload();
  await expect(
    open.getByRole("checkbox", { name: /^buy milk$/i }),
  ).toBeVisible();
  await expect(page.getByText(/^Added “buy milk”$/i)).toBeVisible();
});
