<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

todo-cat is a to-do list web app kept by Lissie, a cat with attitude.
Lissie will be an AI agent, which is not in the code yet.

## Stack and layout

- Next.js 16 App Router at the repo root (`app/`).
- npm workspaces: `contract/` (shared zod schemas) and `cli/` (the todo-cat CLI), both still empty; see [tech-docs/workspaces.md](tech-docs/workspaces.md).
- Biome for linting and formatting, configured in `biome.json`.
- Vitest for unit and integration tests, Playwright for end-to-end tests; see [tech-docs/testing.md](tech-docs/testing.md).

## Commands

- `npm run dev`: start the dev server.
- `npm run build`: production build.
- `npm run lint`: Biome check (lint, format, import order); warnings fail it too.
- `npm run typecheck`: TypeScript check of the root and every workspace.
- `npm run format`: apply Biome formatting.
- `npm test`: run the Vitest tests once.
- `npm run test:e2e`: run the Playwright tests in Chromium; starts its own dev server.
- `npm run qa`: run all of the above checks; CI runs the same script.

## Definition of done

- Run `npm run qa` before you call a task done, and only call it done when it passes.
- Fix the code instead of suppressing findings: no `biome-ignore`, `@ts-expect-error`, `@ts-ignore`, skipped tests, or loosened config to get green.

## Verify, don't remember

- The technologies here are newer than your training data.
- Verify APIs against current docs (for Next.js, `node_modules/next/dist/docs/`) instead of relying on memory.

## Tech docs

`tech-docs/` holds project-specific technical docs; agents are the primary audience.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Describe the current state only; delete outdated content instead of adding caveats.

Index:

- [workspaces.md](tech-docs/workspaces.md): the workspace layout and why it exists before its content does.
- [testing.md](tech-docs/testing.md): test strategy, the QA script, CI, and gotchas for Vitest and Playwright.

## Maintenance

- When your change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update AGENTS.md and the tech docs in the same change.
- Prefer deleting over adding, pointers over prose, and one sentence per bullet.
