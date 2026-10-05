# CLI

`todo-cat` (workspace `cli/`, package `todo-cat-cli`) is a client of the REST API ([rest-api.md](rest-api.md)), built on commander.js 15. Its main users are AI agents working for a human; humans use it too.

## Files

- `cli/src/main.ts`: the program, one command per REST use case plus `login`, `logout`, `whoami`, and the error printer.
- `cli/src/api.ts`: every HTTP call, for todos and for Better Auth's device and session endpoints, with every response parsed by a schema.
- `cli/src/credentials.ts`: the token file.
- `cli/src/errors.ts`: `CliError`, the error-code-to-exit-code table, and the exit code list that `--help` prints.
- `cli/test/cli.test.ts`: the end-to-end test.
- `app/device/`: the web page where a signed-in user approves or denies a login.

## Agent-friendly by design

- Results go to stdout, as text or with `--json` as the REST API's JSON; errors go to stderr as `error (<code>): <message>`, or with `--json` as the contract's `{ error: { code, message } }`.
- An error carries the API's own code when the server sent one; CLI-only codes (`not-logged-in`, `server-unreachable`, `confirmation-required`, …) live in `cli/src/errors.ts`.
- Exit codes group the error codes, and `--help` prints them from the same table, so the help never drifts from the code.
- Nothing ever reads stdin or prompts; `delete` refuses to run without `--yes`.
- Every command's `--help` ends with examples.
- Commander's own usage errors go through `exitOverride()` and come out in the same format, with exit code 2.

## The agent skill

- `.claude/skills/todo-cat-cli/SKILL.md` teaches agents the workflows and pitfalls of managing someone's todos with the CLI; it is not a copy of `--help`, which wins when the two disagree.
- Update the skill when a change breaks one of its workflows, such as a renamed option, a new exit code, or a change in what `list` returns by default.

## Contract use

- Inputs are parsed with the contract schemas before they are sent, so invalid input fails locally with `validation-failed`, the code the server would return.
- A response that fails its contract schema is `unexpected-response` (exit 1), never silently accepted.
- Better Auth's device and session responses are not ours, so `cli/src/api.ts` has small schemas for just the fields it reads.

## Login, the token, logout

- `login` follows RFC 8628 like `gh auth login`: it prints the `/device` URL and the code on stderr, never opens a browser, and polls at the server's interval until the code is approved, denied or expired.
- The token is Better Auth's session token, sent as `Authorization: Bearer`; the CLI never prints it.
- Tokens are stored per server URL, readable by the user only, so a token is only ever sent to the server that issued it.
- A new `login` ends the session it replaces on the server.
- `logout` signs out on the server first and deletes the local token only after that works, so an unreachable server leaves the user logged in, and they can retry.

## The /device page

- It follows the security requirements in Better Auth's device authorization docs: the user enters or confirms the code, the page names the client and what it can do, approval is an explicit button, and a warning says to deny codes someone else sent.
- Looking a code up as a signed-in user claims it for that user (Better Auth's `deviceVerify`); only the claiming user can then approve or deny it.
- Signed-out visitors go to `/login?next=…` and come back after signing in or up.

## Build and install

- esbuild bundles `cli/src/main.ts` into `cli/dist/todo-cat.js` (git-ignored), with the contract's TypeScript inlined and `commander` and `zod` left as runtime dependencies.
- The workspace's `prepare` script builds it on `npm install` and `npm ci`, and npm links the bin, so `npx todo-cat` works from the repo root.
- The QA script builds it in its own `build-cli` section, and `npm run typecheck` checks it through the workspace's `typecheck` script.

## Tests

- `cli/test/cli.test.ts` is a Vitest test that builds the CLI, starts its own `next dev` on a temp database, and drives the built binary as a child process with `XDG_CONFIG_HOME` pointed at a temp dir.
- It approves the device login with Better Auth's `testUtils()` instead of a browser; `e2e/device.spec.ts` covers the `/device` page itself.

## Gotchas

- Commander 15 is ESM only and needs Node 22.12 or later.
- With `--due <date>` and `--no-due` both defined, Commander leaves `due` undefined unless one is passed, which is what lets `edit` tell "leave it" from "remove it".
- Better Auth rejects a second poll within the interval with `slow_down`, so tests that poll by hand must not poll twice within 5 seconds.
- Next's types make `process.env.NODE_ENV` required, so a test that spawns `next dev` sets it explicitly instead of removing it from the env it passes on.
