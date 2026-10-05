import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

// Ask the OS for a free port once; workers re-read this config and inherit the env var.
process.env.E2E_PORT ??= execSync(
  `node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})"`,
)
  .toString()
  .trim();
const baseURL = `http://localhost:${process.env.E2E_PORT}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `next dev --port ${process.env.E2E_PORT}`,
    url: baseURL,
    env: { TODO_CAT_DIST_DIR: ".next-e2e" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
