import { expect, test } from "@playwright/test";

test("the API tester adds, lists and deletes a todo with a bearer token", async ({
  page,
}) => {
  // Retries reuse the run's database, so the email must be unique per attempt.
  const email = `tester-${Date.now()}@example.com`;
  const status = page.getByText(/^Status \d{3}$/);
  const send = page.getByRole("button", { name: "Send request" });

  await page.goto("/api-tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByLabel("Name").fill("Tester");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByRole("radio", { name: /Add a todo/ }).check();
  await page.getByLabel("JSON body").fill('{"title":"Buy tuna"}');
  await send.click();
  await expect(status).toHaveText("Status 201");
  await expect(page.getByText("Matches the contract.")).toBeVisible();

  await page.getByRole("radio", { name: /List todos/ }).check();
  await send.click();
  await expect(status).toHaveText("Status 200");
  await page.getByRole("button", { name: "Use the id of Buy tuna" }).click();

  await page.getByRole("radio", { name: /Delete a todo/ }).check();
  await send.click();
  await expect(status).toHaveText("Status 204");
  await send.click();
  await expect(status).toHaveText("Status 404");
  await expect(page.getByText("Matches the contract.")).toBeVisible();

  await page.getByRole("radio", { name: "None" }).check();
  await send.click();
  await expect(status).toHaveText("Status 401");
  await expect(page.getByText("Matches the contract.")).toBeVisible();
});
