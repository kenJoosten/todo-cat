# Database

SQLite through Drizzle ORM and the `@libsql/client` driver; the file lives at `DATABASE_URL` (`file:./data/app.db` locally).

## Approach

- `lib/db.ts` is the only module that opens the database; import `db` from it, never create another client.
- It imports `server-only`, so a Client Component that reaches it fails the build instead of shipping database code to the browser.
- Mastra memory keeps its `mastra_*` tables in the same file, on the client from `lib/db.ts`; Mastra creates and upgrades them itself, so they are in neither `lib/schema.ts` nor `drizzle/` (see [agent.md](agent.md)).
- Tables live in `lib/schema.ts`, which also re-exports Better Auth's generated tables (see [auth.md](auth.md)); only `lib/todo-service.ts` touches `todos` (see [architecture.md](architecture.md)).
- Schema changes always go through `npm run db:generate` and a committed migration, applied with `npm run db:migrate`, never `drizzle-kit push`, so every database (local, tests, e2e, production) reaches the same schema the same way.

## Why these choices

- Drizzle v1 RC (pinned exactly) instead of the 0.x `latest`: the docs already target v1, and v1 changes the migration folder format, so starting there avoids migrating the format later.
- `@libsql/client` over `better-sqlite3`: no native build step at install time, and the same driver can later talk to a remote libSQL/Turso database.

## Migrations

- `drizzle/` holds one folder per migration (`<timestamp>_<name>/migration.sql` plus `snapshot.json`); v1 has no journal file.
- `db:reset` and `db:seed` refuse any `DATABASE_URL` that is not a `file:` URL, so they can never wipe a remote database or put the public demo password on it.

## Dev seed

- `npm run db:seed` migrates, then creates `demo@todo-cat.dev` (password `cat-person-2026`) and replaces that user's todos with the demo set from `scripts/demo-seed.ts`.
- Running it again on the same day gives the same state, apart from new todo ids; timestamps are relative to the day it runs.

## Tests

- `lib/db.ts` reads `DATABASE_URL` at import time and throws if it is missing, so tests that need a database point it at a temp file with `vi.stubEnv` and then import `lib/` dynamically (see `lib/db.test.ts`).
- `lib/db.test.ts` applies every migration with Drizzle's runtime `migrate()` and checks that each one was recorded and that queries run.
- The e2e server gets its own temp database, migrated before `next dev` starts; see [testing.md](testing.md).

## Gotchas

- Drizzle's API changed a lot in v1 (`drizzle({ connection })` or `drizzle({ client })`, `migrate` from `drizzle-orm/libsql/migrator`, no `schema` option); check `node_modules/drizzle-orm` types before trusting examples.
- Keep `dialect: "sqlite"` in `drizzle.config.ts`: drizzle-kit connects to it through `@libsql/client`, even though its bundled skill recommends `turso` for libSQL.
- libsql enforces foreign keys, so deleting a user cascades to their todos without a `PRAGMA`.
- Scripts that plain Node or a CLI loader runs are `.mts`, because the root `package.json` has no `"type": "module"`.
- In such scripts, `@next/env` is CommonJS, so use its default export (`nextEnv.loadEnvConfig`); the named import fails at runtime even though it typechecks.
- npm blocks the install scripts of esbuild and fsevents (dependencies of drizzle-kit, Vite, tsx and the CLI build); none of them needs its script, so leave them unapproved.
