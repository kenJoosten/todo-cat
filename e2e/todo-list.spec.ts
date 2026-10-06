import { expect, type Page, test } from "@playwright/test";

// The list on /: add, check off, reopen and delete, through its Server Actions.

async function signUp(page: Page, name: string) {
  // Retries reuse the run's database, so the email must be unique per attempt.
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page
    .getByLabel("Email")
    .fill(`${name.toLowerCase()}-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("tuna-o-clock");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: `Back to it, ${name}.` }),
  ).toBeVisible();
}

function sections(page: Page) {
  const list = page.getByRole("region", { name: "Your list" });
  return {
    list,
    open: list.getByRole("region", { name: /^Open/ }),
    done: list.getByRole("region", { name: /^Done/ }),
  };
}

test("add a todo with a due date, and it stays after a reload", async ({
  page,
}) => {
  await signUp(page, "Quinn");
  const { list, open, done } = sections(page);
  // A new list is one empty section, in Lissie's words.
  await expect(open.getByText("An empty list.")).toBeVisible();
  await expect(done).toHaveCount(0);

  await list.getByLabel("New todo").fill("Buy tuna");
  await list.getByLabel("Due (optional)").fill("2031-10-09");
  await list.getByRole("button", { name: "Add" }).click();
  await expect(open.getByRole("listitem")).toHaveText([/^Buy tuna\s*9 Oct/]);
  // The form is ready for the next one.
  await expect(list.getByLabel("New todo")).toHaveValue("");

  await list.getByLabel("New todo").fill("Brush the cat");
  await list.getByLabel("New todo").press("Enter");
  await expect(open.getByRole("listitem")).toHaveCount(2);

  await page.reload();
  await expect(open.getByRole("checkbox", { name: "Buy tuna" })).toBeVisible();
  await expect(
    open.getByRole("checkbox", { name: "Brush the cat" }),
  ).toBeVisible();
});

test("check a todo off, and reopen it", async ({ page }) => {
  await signUp(page, "Rosa");
  const { list, open, done } = sections(page);
  await list.getByLabel("New todo").fill("Feed the cat");
  await list.getByRole("button", { name: "Add" }).click();

  // Checking a todo off moves it to Done, so click it and look for it there.
  await open.getByRole("checkbox", { name: "Feed the cat" }).click();
  await expect(
    done.getByRole("checkbox", { name: "Feed the cat" }),
  ).toBeChecked();
  await expect(open.getByText("Nothing open.")).toBeVisible();
  await page.reload();
  await expect(
    done.getByRole("checkbox", { name: "Feed the cat" }),
  ).toBeChecked();

  await done.getByRole("checkbox", { name: "Feed the cat" }).click();
  await expect(
    open.getByRole("checkbox", { name: "Feed the cat" }),
  ).not.toBeChecked();
  await expect(done.getByText("Nothing done yet.")).toBeVisible();
});

test("delete a todo after confirming, or keep it", async ({ page }) => {
  await signUp(page, "Sami");
  const { list, open } = sections(page);
  await list.getByLabel("New todo").fill("Vacuum the cat hair");
  await list.getByRole("button", { name: "Add" }).click();
  const row = open
    .getByRole("listitem")
    .filter({ hasText: "Vacuum the cat hair" });

  // Asking is not deleting: Keep backs out, and so does Escape.
  await row
    .getByRole("button", { name: "Delete “Vacuum the cat hair”" })
    .click();
  await expect(row.getByText("Delete it?")).toBeVisible();
  await expect(row.getByRole("button", { name: "Keep" })).toBeFocused();
  await row.getByRole("button", { name: "Keep" }).click();
  await expect(row.getByText("Delete it?")).toBeHidden();
  await row
    .getByRole("button", { name: "Delete “Vacuum the cat hair”" })
    .click();
  await page.keyboard.press("Escape");
  await expect(row.getByText("Delete it?")).toBeHidden();

  await row
    .getByRole("button", { name: "Delete “Vacuum the cat hair”" })
    .click();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(open.getByText("An empty list.")).toBeVisible();
  await page.reload();
  await expect(open.getByText("An empty list.")).toBeVisible();
});

test("a checked-off todo stays put while it's scratched, and focus stays on the list", async ({
  page,
}) => {
  await signUp(page, "Tove");
  const { list, open, done } = sections(page);
  for (const title of ["Brush the cat", "Feed the cat", "Buy tuna"]) {
    await list.getByLabel("New todo").fill(title);
    await list.getByLabel("New todo").press("Enter");
    await expect(open.getByRole("checkbox", { name: title })).toBeEnabled();
  }

  // Checked off, it stays in Open with its claw marks, then moves to Done.
  await open.getByRole("checkbox", { name: "Feed the cat" }).press("Space");
  await expect(
    open.getByRole("checkbox", { name: "Feed the cat" }),
  ).toBeChecked();
  await expect(
    done.getByRole("checkbox", { name: "Feed the cat" }),
  ).toBeChecked();
  // Undated todos list newest first, so "Brush the cat" took its place, and has focus.
  await expect(
    open.getByRole("checkbox", { name: "Brush the cat" }),
  ).toBeFocused();

  // Deleting hands focus to the same button on the next row.
  await open.getByRole("button", { name: "Delete “Buy tuna”" }).click();
  await open.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    open.getByRole("button", { name: "Delete “Brush the cat”" }),
  ).toBeFocused();
});
