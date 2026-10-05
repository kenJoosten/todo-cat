import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The e2e server must not collide with `npm run dev` or with another checkout's e2e run,
// so its port, dist dir and database are all its own and overridable via env vars.
// Workers re-read this config and inherit process.env, so each value is chosen once.
process.env.E2E_PORT ??= execSync(
  `node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})"`,
)
  .toString()
  .trim();
process.env.E2E_DIST_DIR ??= ".next-e2e";
process.env.E2E_DATABASE_URL ??= `file:${join(mkdtempSync(join(tmpdir(), "todo-cat-e2e-")), "e2e.db")}`;

const { E2E_PORT: port, E2E_DIST_DIR: distDir } = process.env;
const baseURL = `http://localhost:${port}`;

// Turbopack cannot read files inside its own dist dir, so this sits next to it.
const tsconfig = `${distDir}.tsconfig.json`;
writeFileSync(
  tsconfig,
  JSON.stringify({
    extends: `./${relative(dirname(tsconfig), "tsconfig.json")}`,
  }),
);

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Migrate the e2e database first, so the server starts on the current schema.
    command: `drizzle-kit migrate && next dev --port ${port}`,
    url: baseURL,
    env: {
      TODO_CAT_DIST_DIR: distDir,
      DATABASE_URL: process.env.E2E_DATABASE_URL,
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
