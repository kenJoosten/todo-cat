# Testing

Vitest runs unit and integration tests; Playwright runs end-to-end tests in Chromium against a real `next dev` server.

## Strategy

- Test logic and synchronous components with Vitest; they run in milliseconds and need no server.
- Test `async` Server Components, routing, and full user flows with Playwright, because Vitest cannot render `async` Server Components.
- Colocate Vitest tests with their source as `*.test.ts` or `*.test.tsx`; Playwright specs live in `e2e/` as `*.spec.ts`.
- The file extension picks the Vitest environment: `*.test.ts` runs in Node, `*.test.tsx` runs in jsdom (see the `projects` in `vitest.config.mts`).
- Query the DOM by role and accessible name (`getByRole`), in both tools, so tests survive markup and styling changes.

## Commands

- `npm test`: run all Vitest tests once.
- `npm run test:watch`: Vitest in watch mode.
- `npm run test:e2e`: Playwright; it starts its own dev server, so nothing needs to be running.
- `npx playwright install chromium`: one-time browser download on a new machine.

## Gotchas

- The e2e dev server runs on a free port picked by `playwright.config.ts` and builds into `.next-e2e/` (via `TODO_CAT_DIST_DIR` in `next.config.ts`), because Next 16 holds a lock in the build folder that refuses a second `next dev` there; this lets `npm run test:e2e` run while `npm run dev` is up.
- Next rewrites `tsconfig.json` to include the type folders of whatever build folder it runs with, so the `.next-e2e/` entries there are committed on purpose; keep them.
- `TODO_CAT_DIST_DIR` is our own name because Next already uses `NEXT_DIST_DIR` internally.
- Vitest test globals are off, so Testing Library cannot clean up between tests on its own; `vitest.setup.ts` does it for the jsdom project.
- Vite resolves the `@/*` path alias from `tsconfig.json` natively (`resolve.tsconfigPaths`), so the `vite-tsconfig-paths` plugin from the Next guide is not needed.
