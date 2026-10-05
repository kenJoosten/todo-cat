import { expect, test } from "@playwright/test";

test("sign up, sign out, and sign in again", async ({ page }) => {
  // Retries reuse the run's database, so the email must be unique per attempt.
  const email = `lissie-${Date.now()}@example.com`;
  const password = "tuna-o-clock";

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Name").fill("Lissie");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Hi, Lissie." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Next's route announcer is an alert too, so match the form error by its text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "email and password don't match" }),
  ).toBeVisible();

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Hi, Lissie." }),
  ).toBeVisible();
});
