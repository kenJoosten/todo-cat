import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside React Server Components; tests may import server code.
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: ["**/node_modules/**", "e2e/**"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          exclude: ["**/node_modules/**", "e2e/**"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
