<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

todo-cat is a to-do list web app kept by Lissie, a cat with attitude.
Lissie is an AI agent who chats with the user on `/`; she has no tools yet.

## Stack and layout

- Next.js 16 App Router at the repo root (`app/`).
- One todo service, `lib/todo-service.ts`, with thin adapters around it; see [tech-docs/architecture.md](tech-docs/architecture.md).
- npm workspaces: `contract/` (shared zod schemas) and `cli/` (the `todo-cat` CLI, a REST client); see [tech-docs/workspaces.md](tech-docs/workspaces.md) and [tech-docs/cli.md](tech-docs/cli.md).
- Drizzle ORM (v1 RC) on SQLite via `@libsql/client`; `lib/db.ts` is the only module that opens the database; see [tech-docs/database.md](tech-docs/database.md).
- Vitest for unit and integration tests, Playwright for end-to-end tests; see [tech-docs/testing.md](tech-docs/testing.md).
- Lissie: one Mastra agent, served to a CopilotKit chat over AG-UI by the runtime at `/api/copilotkit`, which guards every route; see [tech-docs/agent.md](tech-docs/agent.md).
- Better Auth (email and password, bearer, device authorization); `getUserId` in `lib/auth.ts` is the only code that reads sessions; see [tech-docs/auth.md](tech-docs/auth.md).
- Tailwind v4; shared UI styling lives in `components/ui/`, so pages compose those components instead of repeating class strings.

## Commands

Every script is in `package.json`; these are the ones whose behavior the name doesn't tell you.

- `npm run qa`: every check (Biome with warnings as errors, typecheck, production build, CLI build, Vitest, Playwright); CI runs the same script.
- `npm run test:e2e:model`: the Playwright specs that call the real model (`*.model.spec.ts`); needs `OPENROUTER_API_KEY` in `.env`, and never runs in QA or CI.
- `npm run dev`: the dev server on port 3000; the Playwright and CLI tests start their own servers, so they don't need it.
- `npm run db:seed`: migrate and (re)create the demo user `demo@todo-cat.dev` / `cat-person-2026` with demo todos.
- `npx biome check --write <files>`: fix formatting and import order (`npm run format` only formats); name your files, because other sessions' uncommitted work may be in the tree.
- `npx todo-cat --help`: the CLI, built by `npm install`; the `todo-cat-cli` skill teaches agents to manage someone's todos with it.
- On a fresh checkout: `npm install`, copy `.env.example` to `.env`, `npm run db:seed`, and `npx playwright install chromium`.

## Definition of done

- Run `npm run qa` before you call a task done, and only call it done when it passes.
- Fix the code instead of suppressing findings: no `biome-ignore`, `@ts-expect-error`, `@ts-ignore`, skipped tests, or loosened config to get green.

## Verify, don't remember

- The technologies here are newer than your training data.
- Verify APIs against current docs (see Researching docs) instead of relying on memory.

## Researching docs

- Next.js: `node_modules/next/dist/docs/`, which matches the installed version exactly.
- Vendors that publish an `llms.txt`: start there and follow its links; for Drizzle that is https://orm.drizzle.team/llms.txt, which documents the v1 RC we use.
- Skills in `.claude/skills/`: load the one that matches a library or area before working on it.
- Skills shipped inside packages: drizzle-kit has them in `node_modules/drizzle-kit/skills/`.
- Mastra packages ship docs for the installed version in `node_modules/@mastra/*/dist/docs/`.
- Any other library: the ctx7 CLI from the `find-docs` skill (`npx ctx7@latest library …`, then `docs …`).
- When docs and code disagree, the installed package's `.d.ts` files are the ground truth for the version we run.

## Tech docs

`tech-docs/` holds project-specific technical docs; agents are the primary audience.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Describe the current state only; delete outdated content instead of adding caveats.

Index:

- [architecture.md](tech-docs/architecture.md): the todo service, its ownership rules, the contract, and the adapters around them.
- [workspaces.md](tech-docs/workspaces.md): the workspace layout, why the contract is its own package, and npm workspace gotchas.
- [database.md](tech-docs/database.md): Drizzle on SQLite, migrations, and how tests get their own databases.
- [testing.md](tech-docs/testing.md): test strategy, the QA script, CI, and gotchas for Vitest and Playwright.
- [rest-api.md](tech-docs/rest-api.md): the `/api/todos` endpoints, their schemas and status codes, and getting a bearer token with curl.
- [auth.md](tech-docs/auth.md): Better Auth setup, the `getUserId` rule, schema generation, and the CLI-facing plugins.
- [agent.md](tech-docs/agent.md): Lissie's Mastra agent, memory, the CopilotKit runtime and its route guard, and the chat on `/`.
- [cli.md](tech-docs/cli.md): the `todo-cat` CLI, its output and exit code rules, device login and token storage, the `/device` page, and its end-to-end test.

## Maintenance

- When your change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update AGENTS.md and the tech docs in the same change.
- Prefer deleting over adding, pointers over prose, and one sentence per bullet.
