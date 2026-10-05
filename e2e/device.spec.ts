import { type APIRequestContext, expect, test } from "@playwright/test";
import { cliClientId, formatUserCode } from "@todo-cat/contract";

// The /device page, where a signed-in user approves or denies what `todo-cat login` asks for.
// The CLI's side (requesting the code, polling for the token) is done here with plain requests.

async function requestCode(request: APIRequestContext) {
  const response = await request.post("/api/auth/device/code", {
    data: { client_id: cliClientId },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { device_code: string; user_code: string };
}

function pollToken(request: APIRequestContext, deviceCode: string) {
  return request.post("/api/auth/device/token", {
    data: {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: cliClientId,
    },
  });
}

test("approve and deny device logins", async ({ page, request }) => {
  const first = await requestCode(request);

  // Signed out: the page sends the user to sign in (here: sign up) and back again.
  await page.goto("/device");
  await expect(page).toHaveURL(/\/login\?next=%2Fdevice$/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Name").fill("Lissie");
  // Retries reuse the run's database, so the email must be unique per attempt.
  await page.getByLabel("Email").fill(`lissie-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Got a code?" }),
  ).toBeVisible();

  await page.getByLabel("Code").fill("NOPE-NOPE");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That code doesn't exist" }),
  ).toBeVisible();

  // The code as typed from the terminal, dash and all.
  await page.getByLabel("Code").fill(formatUserCode(first.user_code));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Is this you?" }),
  ).toBeVisible();
  await expect(page.getByText("The todo-cat CLI wants to use")).toBeVisible();
  await expect(page.getByText(formatUserCode(first.user_code))).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(
    page.getByRole("heading", { name: "Fine. It's in." }),
  ).toBeVisible();

  const token = await (await pollToken(request, first.device_code)).json();
  expect(token.access_token).toBeTruthy();

  // The link with the code in it still asks for an explicit decision.
  const second = await requestCode(request);
  await page.goto(`/device?user_code=${second.user_code}`);
  await expect(
    page.getByRole("heading", { name: "Is this you?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Deny" }).click();
  await expect(
    page.getByRole("heading", { name: "Denied. Good instinct." }),
  ).toBeVisible();
  expect(await (await pollToken(request, second.device_code)).json()).toEqual(
    expect.objectContaining({ error: "access_denied" }),
  );
});
