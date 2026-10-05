# Testing

Vitest runs unit and integration tests; Playwright runs end-to-end tests in Chromium against a real `next dev` server; `scripts/qa.sh` runs every check, locally and in CI.

## Strategy

- Test logic and synchronous components with Vitest; they run in milliseconds and need no server.
- Test `async` Server Components, routing, and full user flows with Playwright, because Vitest cannot render `async` Server Components.
- Colocate Vitest tests with their source as `*.test.ts` or `*.test.tsx`; Playwright specs live in `e2e/` as `*.spec.ts`.
- The file extension picks the Vitest environment: `*.test.ts` runs in Node, `*.test.tsx` runs in jsdom (see the `projects` in `vitest.config.mts`).
- Query the DOM by role and accessible name (`getByRole`), in both tools, so tests survive markup and styling changes.

## Commands

- `npm run qa`: the full gate (Biome, typecheck, production build, Vitest, Playwright); see below.
- `npm test`: run all Vitest tests once; `npm run test:watch` for watch mode.
- `npm run test:e2e`: Playwright; it starts its own dev server, so nothing needs to be running.
- `npx playwright install chromium`: one-time browser download on a new machine.

## QA script

- `scripts/qa.sh` prints one `PASS`/`FAIL` line per tool and a summary, and exits non-zero if any section failed.
- It is written for agents: plain text, no colors, and only failing sections print their output, so the first lines read are the ones to fix.
- Every section's full output goes to `.qa/qa.log`, which is overwritten on each run.
- All sections run even after a failure, so one run reports every problem.
- Biome runs with `--error-on-warnings`, because Biome reports some real mistakes (unused variables, for one) as warnings that exit 0.
- `npm run typecheck` checks the root with `tsc` and runs the `typecheck` script of every workspace that has one; give a workspace that gets its own `tsconfig.json` such a script.

## CI

- `.github/workflows/qa.yml` runs `npm run qa` on every push and pull request, on Node 24 after `npm ci`; it deploys nothing.
- Playwright browsers are cached under `~/.cache/ms-playwright`, keyed by the installed Playwright version, so upgrading Playwright refreshes the cache.
- CI writes `.env` from `.env.example`: keys ending in `_KEY`, `_SECRET`, `_TOKEN` or `_PASSWORD` get a random `ci-dummy-…` value, all others are copied, so add every new env var there and name secrets accordingly.
- Never put real secrets in CI; when a check needs a real external service, mock it instead.
- On failure, CI uploads `.qa/` and `test-results/` as the `qa-results` artifact.

## E2E isolation

The e2e server must never collide with `npm run dev` or with another checkout running at the same time, so `playwright.config.ts` gives it its own resources, each overridable:

- `E2E_PORT`: defaults to a free port the OS picks per run.
- `E2E_DIST_DIR`: defaults to `.next-e2e`; keep the `.next-e2e` prefix so git and Biome ignore it.
- `E2E_DATABASE_URL`: defaults to `file:<fresh temp dir>/e2e.db`, handed to the server as `DATABASE_URL`; the OS cleans up the temp dir.

## Gotchas

- Next 16 holds a lock in the dist dir that refuses a second `next dev` there, which is why the e2e server needs its own dist dir (via `TODO_CAT_DIST_DIR` in `next.config.ts`; Next already uses `NEXT_DIST_DIR` internally).
- Next adds its dist dir's type globs to whatever tsconfig it uses, so with a custom dist dir the e2e server gets a throwaway `<dist dir>.tsconfig.json` that extends the real one, which keeps `tsconfig.json` untouched.
- That throwaway tsconfig sits next to the dist dir, not inside it, because Turbopack cannot read files inside its own dist dir.
- Playwright workers re-read `playwright.config.ts`, so every generated value is stored in `process.env` once and inherited by the workers.
- Vitest test globals are off, so Testing Library cannot clean up between tests on its own; `vitest.setup.ts` does it for the jsdom project.
- Vite resolves the `@/*` path alias from `tsconfig.json` natively (`resolve.tsconfigPaths`), so the `vite-tsconfig-paths` plugin from the Next guide is not needed.
