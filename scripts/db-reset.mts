// Deletes the local SQLite database file; `npm run db:reset` then migrates a fresh one.
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

// @next/env is CommonJS, so plain Node only exposes its default export.
nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  throw new Error(`db:reset only deletes local files, not "${url}"`);
}
const file = url.startsWith("file://")
  ? fileURLToPath(url)
  : url.slice("file:".length);

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  rmSync(file + suffix, { force: true });
}
console.log(`Deleted ${file}`);
