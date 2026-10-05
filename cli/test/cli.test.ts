// End to end: the built CLI against a real `next dev` server on a spare port, with a temp
// database and a temp config directory. The device login is approved through Better Auth's
// test utils on the same database, so no browser is needed.
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { todoListSchema, todoSchema } from "@todo-cat/contract";
import { betterAuth } from "better-auth/minimal";
import { testUtils } from "better-auth/plugins";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const root = join(import.meta.dirname, "../..");
const bin = join(root, "cli/dist/todo-cat.js");
const secret = "test-secret-that-is-at-least-32-chars";
// The .next-e2e prefix keeps the dev server's build out of git, Biome and tsc.
const distDir = ".next-e2e-cli";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-cli-test-"));
const databaseUrl = `file:${join(dir, "test.db")}`;
const configHome = join(dir, "config");
const credentials = join(configHome, "todo-cat", "credentials.json");

const port = await new Promise<number>((resolve) => {
  const probe = createServer().listen(0, () => {
    const address = probe.address();
    probe.close(() =>
      resolve(typeof address === "object" && address ? address.port : 0),
    );
  });
});
const base = `http://localhost:${port}`;

vi.stubEnv("DATABASE_URL", databaseUrl);
vi.stubEnv("BETTER_AUTH_SECRET", secret);
vi.stubEnv("BETTER_AUTH_URL", base);
const { db } = await import("@/lib/db");
const { auth } = await import("@/lib/auth");
await migrate(db, { migrationsFolder: join(root, "drizzle") });

// Test-only instance on the server's database: creates the user and approves the code.
const testAuth = betterAuth({
  ...auth.options,
  plugins: [...auth.options.plugins, testUtils()],
});
const helpers = (await testAuth.$context).test;

let server: ChildProcess;

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("next dev exited early");
    try {
      if ((await fetch(`${base}/api/auth/ok`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("next dev did not start within two minutes");
}

beforeAll(async () => {
  execFileSync("npm", ["run", "--silent", "build", "-w", "cli"], { cwd: root });
  // Next adds its dist dir's types to the tsconfig it uses, so it gets a throwaway one.
  writeFileSync(
    join(root, `${distDir}.tsconfig.json`),
    JSON.stringify({ extends: "./tsconfig.json" }),
  );
  server = spawn(
    join(root, "node_modules/.bin/next"),
    ["dev", "--port", `${port}`],
    {
      cwd: root,
      env: {
        ...process.env,
        // Vitest sets NODE_ENV=test, which next dev must not inherit.
        NODE_ENV: "development",
        TODO_CAT_DIST_DIR: distDir,
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: base,
        BETTER_AUTH_SECRET: secret,
      },
      // Its own process group, so afterAll stops next dev and its workers together.
      detached: true,
      stdio: "ignore",
    },
  );
  await waitForServer();
}, 180_000);

afterAll(async () => {
  if (server?.pid && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    process.kill(-server.pid, "SIGTERM");
    await exited;
  }
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

type Run = { exitCode: number | null; stdout: string; stderr: string };

/** Runs the built CLI as a user would; `onStderr` sees the output while it runs. */
function cli(args: string[], onStderr?: (text: string) => void): Promise<Run> {
  const child = spawn(process.execPath, [bin, ...args], {
    env: { ...process.env, TODO_CAT_URL: base, XDG_CONFIG_HOME: configHome },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    onStderr?.(stderr);
  });
  return new Promise((resolve) =>
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })),
  );
}

async function json(args: string[]) {
  const run = await cli([...args, "--json"]);
  expect(run.stderr).toBe("");
  expect(run.exitCode).toBe(0);
  return JSON.parse(run.stdout);
}

function errorOf(run: Run) {
  return JSON.parse(run.stderr).error;
}

describe("the todo-cat CLI against a real server", () => {
  const email = "lissie@example.com";
  let token: string;
  let todoId: string;

  test("login waits for the code to be approved and saves the token", async () => {
    const user = await helpers.saveUser(
      helpers.createUser({ name: "Lissie", email }),
    );
    const headers = await helpers.getAuthHeaders({ userId: user.id });
    let approval: Promise<unknown> | undefined;

    const run = await cli(["login", "--json"], (stderr) => {
      const code = stderr.match(/code ([A-Z0-9]{4}-[A-Z0-9]{4})/)?.[1];
      if (!code || approval) return;
      expect(stderr).toContain(`${base}/device`);
      // What the /device page does for a signed-in user: claim the code, then approve it.
      approval = testAuth.api
        .deviceVerify({ query: { user_code: code }, headers })
        .then(() =>
          testAuth.api.deviceApprove({ body: { userCode: code }, headers }),
        );
    });

    await approval;
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      server: base,
      user: { name: "Lissie", email },
    });

    // Owner-only file in an owner-only directory, and the token never printed.
    expect(statSync(credentials).mode & 0o777).toBe(0o600);
    expect(statSync(join(configHome, "todo-cat")).mode & 0o777).toBe(0o700);
    token = JSON.parse(readFileSync(credentials, "utf8")).servers[base].token;
    expect(token).toBeTruthy();
    expect(run.stdout + run.stderr).not.toContain(token);
  }, 60_000);

  test("whoami names the user", async () => {
    expect(await json(["whoami"])).toMatchObject({ user: { email } });
    expect((await cli(["whoami"])).stdout).toContain(`as Lissie <${email}>`);
  });

  test("add creates a todo", async () => {
    const todo = todoSchema.parse(
      await json(["add", "Buy", "tuna", "--due", "2026-10-31"]),
    );
    expect(todo).toMatchObject({
      title: "Buy tuna",
      dueDate: "2026-10-31",
      done: false,
    });
    todoId = todo.id;
  });

  test("list shows it, as JSON and as text", async () => {
    const todos = todoListSchema.parse(await json(["list"]));
    expect(todos.map((todo) => todo.id)).toEqual([todoId]);
    const run = await cli(["list"]);
    expect(run.stdout).toBe(`[ ] ${todoId}  Buy tuna  (due 2026-10-31)\n`);
  });

  test("done marks it done", async () => {
    expect(todoSchema.parse(await json(["done", todoId])).done).toBe(true);
    expect(await json(["list"])).toEqual([]);
    const done = todoListSchema.parse(await json(["list", "--status", "done"]));
    expect(done.map((todo) => todo.id)).toEqual([todoId]);
  });

  test("delete needs --yes, then deletes it", async () => {
    const unconfirmed = await cli(["delete", todoId, "--json"]);
    expect(unconfirmed.exitCode).toBe(2);
    expect(errorOf(unconfirmed).code).toBe("confirmation-required");

    expect(await json(["delete", todoId, "--yes"])).toEqual({
      id: todoId,
      deleted: true,
    });
    const gone = await cli(["show", todoId, "--json"]);
    expect(gone.exitCode).toBe(4);
    expect(errorOf(gone).code).toBe("todo-not-found");
  });

  test("invalid input fails before it reaches the server", async () => {
    const run = await cli(["add", "Nap", "--due", "tomorrow", "--json"]);
    expect(run.exitCode).toBe(2);
    expect(errorOf(run).code).toBe("validation-failed");
  });

  test("logout revokes the session and deletes the token", async () => {
    expect(await json(["logout"])).toEqual({ server: base, loggedOut: true });
    expect(() => statSync(credentials)).toThrow();
    const response = await fetch(`${base}/api/todos`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(401);
  });

  test("whoami fails after logout", async () => {
    const run = await cli(["whoami", "--json"]);
    expect(run.exitCode).toBe(3);
    expect(errorOf(run).code).toBe("not-logged-in");
  });
});
