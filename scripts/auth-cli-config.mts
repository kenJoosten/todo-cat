// Config for the Better Auth CLI only (`npm run auth:generate`). The CLI cannot load
// lib/auth.ts, because lib/db.ts imports `server-only`; generating the schema never
// touches the database, so the adapter gets an empty stand-in for it.
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { authOptions, drizzleAdapterConfig } from "../lib/auth-options";
import * as schema from "../lib/auth-schema";

export const auth = betterAuth({
  ...authOptions,
  // The current schema lets `auth check` compare it with the config.
  database: drizzleAdapter({}, { ...drizzleAdapterConfig, schema }),
});
