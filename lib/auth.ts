import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { authOptions, drizzleAdapterConfig } from "./auth-options";
import * as schema from "./auth-schema";
import { db } from "./db";

// The app's Better Auth instance; secret and base URL come from BETTER_AUTH_SECRET and BETTER_AUTH_URL.
export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { ...drizzleAdapterConfig, schema }),
  // nextCookies lets Server Actions set the session cookie; it must stay last.
  plugins: [...authOptions.plugins, nextCookies()],
});

/**
 * The id of the signed-in user, from the session cookie or an `Authorization: Bearer` token,
 * or null when the request carries neither (or only invalid ones).
 * This is the only place that reads sessions: every adapter (pages, REST, agent tools, MCP)
 * calls it with `request.headers`, or with `await headers()` in Server Components and Actions.
 */
export async function getUserId(headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
