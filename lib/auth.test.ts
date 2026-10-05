import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { betterAuth } from "better-auth/minimal";
import { testUtils } from "better-auth/plugins";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, describe, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-auth-test-"));
vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-that-is-at-least-32-chars");
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
const { db } = await import("./db");
const { auth, getUserId } = await import("./auth");
await migrate(db, { migrationsFolder: "drizzle" });

// Test-only instance: the app's options and database plus testUtils, which stays out of production.
const testAuth = betterAuth({
  ...auth.options,
  plugins: [...auth.options.plugins, testUtils()],
});
const helpers = (await testAuth.$context).test;

afterAll(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("email and password", () => {
  const credentials = { email: "lissie@example.com", password: "tuna-o-clock" };

  test("sign-up creates the user and signs them in", async () => {
    const result = await auth.api.signUpEmail({
      body: { name: "Lissie", ...credentials },
    });
    expect(result.user).toMatchObject({
      name: "Lissie",
      email: credentials.email,
    });
    expect(result.token).toBeTruthy();
  });

  test("the right password signs in", async () => {
    const result = await auth.api.signInEmail({ body: credentials });
    expect(result.user.email).toBe(credentials.email);
    expect(result.token).toBeTruthy();
  });

  test("a wrong password is rejected", async () => {
    await expect(
      auth.api.signInEmail({
        body: { ...credentials, password: "not-the-password" },
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
  });
});

describe("getUserId", () => {
  async function savedUser() {
    return helpers.saveUser(helpers.createUser());
  }

  test("returns the user id for a session cookie", async () => {
    const user = await savedUser();
    const headers = await helpers.getAuthHeaders({ userId: user.id });
    expect(await getUserId(headers)).toBe(user.id);
  });

  test("returns the user id for a bearer token", async () => {
    const user = await savedUser();
    const { token } = await helpers.login({ userId: user.id });
    const headers = new Headers({ authorization: `Bearer ${token}` });
    expect(await getUserId(headers)).toBe(user.id);
  });

  test("returns null without a cookie or a token", async () => {
    expect(await getUserId(new Headers())).toBeNull();
  });

  test("returns null for an unknown bearer token", async () => {
    const headers = new Headers({ authorization: "Bearer not-a-session" });
    expect(await getUserId(headers)).toBeNull();
  });
});
