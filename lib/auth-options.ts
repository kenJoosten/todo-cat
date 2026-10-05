import type { BetterAuthOptions } from "better-auth/minimal";
import { bearer, deviceAuthorization } from "better-auth/plugins";

// The client id the todo-cat CLI sends when it starts a device login.
export const cliClientId = "todo-cat-cli";

// Shared by the app's instance (lib/auth.ts), the test instance, and the schema generator
// (scripts/auth-cli-config.ts). Everything that shapes the database schema belongs here,
// so the generated schema always matches what the app runs.
export const authOptions = {
  emailAndPassword: { enabled: true },
  plugins: [
    // REST API and CLI clients send `Authorization: Bearer <session token>`.
    bearer(),
    // The CLI logs in like `gh auth login`; its approval page at /device comes later.
    deviceAuthorization({
      verificationUri: "/device",
      validateClient: (clientId) => clientId === cliClientId,
    }),
  ],
} satisfies BetterAuthOptions;

export const drizzleAdapterConfig = { provider: "sqlite" } as const;
