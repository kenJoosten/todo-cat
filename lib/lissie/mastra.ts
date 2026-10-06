import "server-only";
import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { db } from "../db";
import { lissie } from "./agent";

// Mastra keeps its memory tables (mastra_*) in the app's SQLite file, on the client lib/db.ts
// opened, so there is still one place that opens the database. It creates them on first use.
export const mastra = new Mastra({
  agents: { lissie },
  storage: new LibSQLStore({ id: "todo-cat", client: db.$client }),
});
