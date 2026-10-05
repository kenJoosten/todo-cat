# Testing

Vitest runs unit and integration tests; Playwright runs end-to-end tests in Chromium against a real `next dev` server; `scripts/qa.sh` runs every check, locally and in CI.

## Strategy

- Test logic and synchronous components with Vitest; they run in milliseconds and need no server.
- Test `async` Server Components, routing, and full user flows with Playwright, because Vitest cannot render `async` Server Components.
- Colocate Vitest tests with their source as `*.test.ts` or `*.test.tsx`; Playwright specs live in `e2e/` as `*.spec.ts`.
- The CLI's end-to-end test is a Vitest test that starts its own `next dev`; see [cli.md](cli.md).
- The file extension picks the Vitest environment: `*.test.ts` runs in Node, `*.test.tsx` runs in jsdom.
- Query the DOM by role and accessible name (`getByRole`), in both tools, so tests survive markup and styling changes.

## Commands

- `npm test`: all Vitest tests once; `npm test -- <path>` runs one file.
- `npm run test:e2e`: Playwright; it starts its own dev server, so nothing needs to be running; `npm run test:e2e -- e2e/<name>.spec.ts` runs one spec.
- `npx playwright install chromium`: one-time browser download on a new machine.

## QA script

- `scripts/qa.sh` is written for agents: plain text, no colors, one `PASS`/`FAIL` line per section, and only failing sections print their output, so the first lines read are the ones to fix.
- Every section's full output goes to `.qa/qa.log`, and all sections run even after a failure, so one run reports every problem.
- Biome runs with `--error-on-warnings`, because Biome reports some real mistakes (unused variables, for one) as warnings that exit 0.
- `npm run typecheck` runs `next typegen` first, because globals like `LayoutProps` only exist once Next has generated `.next/types`; a fresh checkout fails `tsc` without it.
- `npm run typecheck` then checks the root with `tsc` and runs the `typecheck` script of every workspace that has one; give a workspace that gets its own `tsconfig.json` such a script.

## CI

- `.github/workflows/qa.yml` runs `npm run qa` on every push and pull request, on Node 24 after `npm ci`; it deploys nothing.
- CI starts from a clean checkout, so leftovers in a local tree (generated types, empty folders, untracked files) can make QA pass locally and fail there.
- CI writes `.env` from `.env.example`: keys ending in `_KEY`, `_SECRET`, `_TOKEN` or `_PASSWORD` get a random `ci-dummy-…` value, all others are copied, so add every new env var there and name secrets accordingly.
- Never put real secrets in CI; when a check needs a real external service, mock it instead.
- On failure, CI uploads `.qa/` and `test-results/` as the `qa-results` artifact.

## E2E isolation

The e2e server must never collide with `npm run dev` or with another checkout running at the same time, so `playwright.config.ts` gives it its own resources, each overridable:

- `E2E_PORT`: defaults to a free port the OS picks per run.
- `E2E_DIST_DIR`: defaults to `.next-e2e`; keep the `.next-e2e` prefix so git, Biome and `tsc` ignore it.
- `E2E_DATABASE_URL`: defaults to `file:<fresh temp dir>/e2e.db`, handed to the server as `DATABASE_URL` and migrated by `drizzle-kit migrate` before `next dev` starts.
- The CLI test's `next dev` follows the same rules on its own: a spare port, dist dir `.next-e2e-cli`, and a temp database.

## Gotchas

- Next 16 holds a lock in the dist dir that refuses a second `next dev` there, which is why the e2e server needs its own dist dir (via `TODO_CAT_DIST_DIR` in `next.config.ts`; Next already uses `NEXT_DIST_DIR` internally).
- Next adds its dist dir's type globs to whatever tsconfig it uses, so a custom dist dir gets a throwaway `<dist dir>.tsconfig.json` next to it that extends the real one; that is what the `.next-e2e*.tsconfig.json` files in the root are.
- A Playwright `webServer` timeout usually means the server started but answers 500, and Playwright hides its output: run `TODO_CAT_DIST_DIR=.next-e2e npx next dev --port <port>` and curl it to see the error.
- The `webServer` command calls `drizzle-kit` by name, so run Playwright through `npm run test:e2e` or `npx`; `node_modules/.bin/playwright` on its own fails with exit code 127.
- Next renders its own `role="alert"` route announcer on every page, so locate an alert by its text (`getByRole("alert").filter({ hasText })`).
- Todos added in one test can share a millisecond, so a test that asserts list order pins the clock with `vi.useFakeTimers({ toFake: ["Date"] })`, as `lib/todo-service.test.ts` does.
- Vite resolves the `@/*` path alias from `tsconfig.json` natively (`resolve.tsconfigPaths`), so the `vite-tsconfig-paths` plugin from the Next guide is not needed.
