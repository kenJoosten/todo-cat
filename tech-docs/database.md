# Database

SQLite through Drizzle ORM and the `@libsql/client` driver; the file lives at `DATABASE_URL` (`file:./data/app.db` locally).

## Approach

- `lib/db.ts` is the only module that opens the database; import `db` from it, never create another client.
- It imports `server-only`, so a Client Component that reaches it fails the build instead of shipping database code to the browser.
- Tables live in `lib/schema.ts`; drizzle-kit diffs that file against the latest migration snapshot to generate SQL.
- `lib/schema.ts` re-exports Better Auth's generated tables from `lib/auth-schema.ts` (see [auth.md](auth.md)); todos arrive with the architecture.
- Schema changes always go through `npm run db:generate` and a committed migration, never `drizzle-kit push`, so every database (local, tests, e2e, production) reaches the same schema the same way.

## Why these choices

- Drizzle v1 RC (pinned exactly) instead of the 0.x `latest`: the docs already target v1, and v1 changes the migration folder format, so starting there avoids migrating the format later.
- `@libsql/client` over `better-sqlite3`: no native build step at install time, and the same driver can later talk to a remote libSQL/Turso database.
- `drizzle.config.ts` and `scripts/db-reset.mts` load `.env` through `@next/env`, so drizzle-kit sees the same variables, with the same precedence, as Next.

## Migrations

- `drizzle/` holds one folder per migration (`<timestamp>_<name>/migration.sql` plus `snapshot.json`); v1 has no journal file.
- `db:reset` refuses any `DATABASE_URL` that is not a `file:` URL, so it can never wipe a remote database.

## Tests

- `lib/db.test.ts` points `DATABASE_URL` at a temp file before importing `lib/db.ts`, applies every migration with Drizzle's runtime `migrate()`, and checks that each one was recorded and that queries run.
- The e2e server gets its own temp database, migrated before `next dev` starts; see [testing.md](testing.md).

## Gotchas

- Drizzle's API changed a lot in v1 (`drizzle({ connection })` or `drizzle({ client })`, `migrate` from `drizzle-orm/libsql/migrator`, no `schema` option); check `node_modules/drizzle-orm` types before trusting examples.
- `lib/db.ts` reads `DATABASE_URL` at import time and throws if it is missing; set the variable before the first import (tests use `vi.stubEnv` plus a dynamic import).
- `@next/env` is CommonJS, so plain Node scripts must use its default export (`nextEnv.loadEnvConfig`); the named import fails at runtime even though it typechecks.
- npm blocks the install scripts of esbuild and fsevents (drizzle-kit dependencies); neither is needed, so leave them unapproved.
