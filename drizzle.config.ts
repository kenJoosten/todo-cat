import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env files the way Next does; variables already in the environment win.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set; copy .env.example to .env");

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
