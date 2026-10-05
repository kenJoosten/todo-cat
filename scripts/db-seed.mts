// Seeds the local database with a demo user and their todos; `npm run db:seed` runs it with
// tsx under the react-server condition, so `server-only` in lib/ resolves to its empty module.
import nextEnv from "@next/env";

// @next/env is CommonJS, so plain Node only exposes its default export.
nextEnv.loadEnvConfig(process.cwd());

// The demo password is public; never put that account on a shared database.
const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  throw new Error(`db:seed only seeds local files, not "${url}"`);
}

// lib/db.ts reads DATABASE_URL on import, so load it only after the environment.
const { demoUser, seedDemo } = await import("./demo-seed");
const { todos } = await seedDemo();
console.log(
  `Seeded ${todos.length} todos for ${demoUser.email} (password: ${demoUser.password})`,
);
