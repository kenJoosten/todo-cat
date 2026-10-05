---
name: todo-cat-cli
description: Manage a person's to-do list with the `todo-cat` CLI - answer questions about their todos (what's overdue, what's due this week, what they added or finished recently) and add, rename, reschedule, complete, reopen or delete todos for them. Use this skill whenever the user talks about their todos, tasks, to-do list, reminders or Lissie's list in todo-cat, even if they don't mention the CLI, and whenever you are about to run `todo-cat` or `npx todo-cat`.
---

# Managing a to-do list with todo-cat

`todo-cat` is the command-line client of the todo-cat REST API. It acts as one person: whoever logged it in. Use it to read and change that person's todos; don't reach for the REST API, the database or the web app instead, because the CLI is the interface meant for agents and it validates input the same way the server does.

`todo-cat --help` and `todo-cat <command> --help` are the source of truth for commands, options and exit codes. If anything here disagrees with the help, trust the help. Read it once at the start of a session instead of guessing flags.

In this repository, run it as `npx todo-cat` from the repo root (it is built by `npm install`); elsewhere it may be installed as `todo-cat`.

## Before anything: is it logged in?

Run `todo-cat whoami` first. It prints who you act as and on which server.

If it fails with `not-logged-in` or `unauthorized` (exit code 3), stop and tell the user, for example:

> The todo-cat CLI isn't logged in. Please run `npx todo-cat login` yourself (in Claude Code you can type `! npx todo-cat login`), open the URL it prints, sign in, and approve the code. Then tell me and I'll carry on.

Logging in needs the person's approval in their browser, and that approval is the point: it's how they decide that an agent may act on their list. So don't work around it: no signing in with curl or demo credentials, no reading the token file, no going to the API or the database directly, and no running `login` and approving it yourself.

If it fails with `server-unreachable` (exit code 5), the server isn't running at that URL (`TODO_CAT_URL`, default `http://localhost:3000`). Tell the user; in this repo `npm run dev` starts it.

## Read with `--json`, answer with jq

The text output is for humans and may change. Whenever you need ids, dates or counts, use `--json` and filter with jq. `list --json` returns an array of todos:

```json
{ "id": "7b2613b1-…", "title": "Renew the pet insurance", "dueDate": "2026-10-03",
  "done": false, "createdAt": "2026-09-26T07:00:00.000Z", "completedAt": null }
```

`list` shows only open todos by default. Add `--status all` (or `done`) whenever the question could involve finished todos, such as "what did I get done", "did I already…", or anything to reopen.

Get today's date from the shell (`date +%F`) instead of assuming it, and compute ranges like "this week" from it.

```bash
today=$(date +%F)
# overdue: open, with a due date before today
npx todo-cat list --json | jq --arg t "$today" '[.[] | select(.dueDate != null and .dueDate < $t)]'
# due in the next 7 days, today included
npx todo-cat list --json | jq --arg t "$today" --arg e "$(date -v+6d +%F 2>/dev/null || date -d '+6 days' +%F)" \
  '[.[] | select(.dueDate != null and .dueDate >= $t and .dueDate <= $e)] | map({title, dueDate})'
# finished since a date
npx todo-cat list --status done --json | jq --arg s 2026-09-28 '[.[] | select(.completedAt >= $s)] | map(.title)'
```

When you answer, talk in titles and dates, not ids; ids mean nothing to the person.

## Which date does the question mean?

A todo has three dates, and phrases like "last week" can point at any of them:

- `dueDate` (`yyyy-mm-dd`, or `null`): when it should be done. "What's due", "overdue", "for Friday", "this week's todos".
- `createdAt` (ISO timestamp, UTC): when it was added. "What did I add last week", "new todos", "what came in recently".
- `completedAt` (ISO timestamp, UTC, `null` while open): when it was ticked off. "What did I finish", "what got done last week".

Pick the one the wording points to, and when it really is ambiguous ("what's from last week?"), say which reading you used or ask. Todos without a due date are never overdue, so mention them separately if they matter. The timestamps are UTC, so a todo added late in the evening may carry the next day's date; compare at day level and don't sweat a few hours at the edge of a range unless the result depends on it.

## Find by title, then act on the id

People name todos by title ("the vet one"), but `show`, `edit`, `done`, `reopen` and `delete` take an id. So look the todo up first:

```bash
npx todo-cat list --status all --search vet --json | jq 'map({id, title, done, dueDate})'
```

`--search` matches a case-insensitive substring of the title. Try a shorter or different word if nothing matches ("insurance" rather than "pet insurance renewal").

- Exactly one match: act on its id.
- Several matches: don't guess. Show the person the candidates and ask which one, unless the wording clearly picks one (only one is open, say, and they asked to finish it).
- No match: say so and offer to add it or look with other words; don't pick something merely similar.

Take the id from the JSON in the same step rather than retyping it, and after a change, the command's output (or `show <id>`) confirms the result. An exit code 4 (`todo-not-found`) means the id is wrong or the todo is gone; search again instead of retrying.

## Changing things

- `add <title> [--due yyyy-mm-dd]`: turn relative dates ("Friday", "end of the month") into `yyyy-mm-dd` yourself, and mention the date you picked. Quote titles in the shell, and check the list first if a duplicate seems likely.
- `edit <id> --title … / --due … / --no-due`: only the options you pass change.
- `done <id>` and `reopen <id>`: completing is the normal end of a todo; nothing is lost and it can be reopened.

Input errors exit with 2 and say what is wrong (`validation-failed`, `usage`); fix the input instead of trying variations blindly.

## Destructive commands only on request

`delete` removes a todo for good, so run it only when the person asked to delete or remove that todo. "I did it" or "that's handled" means `done`, not `delete`; "forget about it" or "I'm not doing that" is worth a quick question if it's unclear whether they want it gone or ticked off.

`delete` refuses without `--yes` (`confirmation-required`, exit 2). That refusal is a safety catch for agents: add `--yes` only because the person asked for the deletion, never just to get past the error. For several deletions at once, list what you're about to delete and get a yes first.

`logout` ends the session the person approved, so run it only when they ask. Changing `TODO_CAT_URL` points the CLI at another server where it is not logged in; leave it alone unless the person tells you which server to use.

## Exit codes at a glance

0 success, 1 unexpected, 2 usage or invalid input, 3 not logged in, 4 todo not found, 5 server unreachable, 6 login denied or expired. With `--json`, errors arrive on stderr as `{"error":{"code","message"}}`. Check `todo-cat --help` for the current list.
