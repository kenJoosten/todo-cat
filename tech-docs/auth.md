# Authentication

Better Auth with email and password only, on the Drizzle database from `lib/db.ts`; `better-auth`, `@better-auth/drizzle-adapter` and the `auth` CLI are pinned to the same exact version.

## Files

- `lib/auth-options.ts`: the options every instance shares; anything that shapes the database schema (methods, plugins) goes here.
- `lib/auth.ts`: the app's instance and `getUserId`.
- `lib/auth-schema.ts`: Better Auth's Drizzle tables, generated; never edit it by hand.
- `scripts/auth-cli-config.mts`: the config the Better Auth CLI loads.
- `app/api/auth/[...all]/route.ts`: Better Auth's HTTP endpoints under `/api/auth/*`.
- `app/auth-actions.ts`: the sign-up, sign-in and sign-out Server Actions behind the forms.
- `app/device/`: the page where a signed-in user approves or denies a device login ([cli.md](cli.md)).

## Principles

- `getUserId(headers)` is the only code that reads sessions, from a cookie or a bearer token alike: pages, Server Actions and every adapter call it; nothing else calls `auth.api.getSession`.
- Every page and action checks the session itself, server-side; there is no proxy (middleware) check, as both Next and Better Auth advise.
- `/` redirects signed-out visitors to `/login`; the `(auth)` layout sends signed-in users from `/login` and `/signup` back to `/`.
- `/login` and `/signup` take a `next` path to return to after signing in; `app/return-path.ts` drops anything that is not a path on this site.
- The forms post to Server Actions that call `auth.api`, so they work before hydration, no auth client ships to the browser, and every session read stays behind `getUserId`.
- Failed sign-ups and sign-ins return a message per Better Auth error code (see `app/auth-actions.ts`); unknown errors are rethrown, not shown.

## Changing the schema

1. Change `lib/auth-options.ts`, for example by adding a plugin.
2. `npm run auth:generate` rewrites `lib/auth-schema.ts` from the options.
3. `npm run db:generate` and `npm run db:migrate`, as for any schema change ([database.md](database.md)); never `auth migrate`, which only works with Better Auth's built-in Kysely adapter.

`npx auth check --config scripts/auth-cli-config.mts` reports whether the generated schema still matches the options.

## Plugins for API and CLI clients

- Bearer: sign-in and sign-up responses carry the token in a `set-auth-token` header, and clients send it back as `Authorization: Bearer <token>`.
- Bearer's `requireSignature` stays off, because the device flow hands out raw session tokens, which the plugin signs itself.
- Device authorization uses the first-party flow: the CLI requests a code at `/api/auth/device/code`, the user approves it at `/device`, and the CLI polls `/api/auth/device/token` for a session token it then sends as a bearer token.
- Only the client id `cliClientId` (`todo-cat-cli`, from the contract) may start a device login; `validateClient` rejects any other.
- Sign-out with a bearer token ends that session, which is how `todo-cat logout` revokes its token.

## Tests

- `lib/auth.test.ts` runs the real `auth` and `getUserId` against a temp database, with `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` stubbed before the first import.
- It builds a test-only instance from `auth.options` plus `testUtils()`, whose helpers create users and sessions; the real instance accepts those sessions because both share the secret and the database.
- `testUtils()` must never enter `lib/auth-options.ts` or `lib/auth.ts`: its helpers can create sessions for any user.
- `e2e/auth.spec.ts` walks through the real sign-up, sign-out and sign-in flow in the browser.

## Gotchas

- Better Auth's installation guide imports `better-auth/adapters/drizzle`, which re-exports the Relations v1 adapter; Drizzle v1 needs `@better-auth/drizzle-adapter/relations-v2`.
- `betterAuth` comes from `better-auth/minimal`, which leaves out the Kysely adapter we do not use.
- `auth generate` writes imports in an order Biome rejects, so `npm run auth:generate` runs `biome check --write` on the file afterwards.
