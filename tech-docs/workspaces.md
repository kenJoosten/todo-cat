# Workspaces

The repo is one npm workspace root: the Next.js app lives at the root, and `contract/` and `cli/` are workspaces declared in `package.json`.

## Layout

- Root: the Next.js 16 web app (`app/`), plus the shared tooling (Biome, TypeScript, the single `package-lock.json`).
- `contract/` (`@todo-cat/contract`): zod schemas shared by the web app and the CLI; the root depends on it like on any package.
- `cli/` (`todo-cat-cli`): the todo-cat command-line client, bundled to `cli/dist/` on install; see [cli.md](cli.md).

## Why the contract is its own package

- The web app and the CLI talk about the same to-dos, so their data shapes live in one package instead of drifting apart in two.

## Gotchas

- Run `npm install` from the repo root only; a single lockfile covers all workspaces.
- Add a dependency to one workspace with `npm install <pkg> -w contract` (or `-w cli`), not by running npm inside the folder.
- `contract/` exports `src/index.ts` directly, with no build step, and is typechecked by the root `tsconfig.json`; Turbopack, Vitest, tsx and the CLI's esbuild bundle compile it where it is imported, so Next needs no `transpilePackages`.
- `cli/` has its own `tsconfig.json` (Node types, no DOM) and a `typecheck` script; its test in `cli/test/` imports `lib/`, so the root `tsconfig.json` checks it.
