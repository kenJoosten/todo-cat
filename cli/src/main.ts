#!/usr/bin/env node
import { setTimeout as sleep } from "node:timers/promises";
import {
  formatUserCode,
  newTodoSchema,
  todoListFilterSchema,
  todoStatusSchema,
  todoUpdateSchema,
} from "@todo-cat/contract";
import { Command, CommanderError, Option } from "commander";
import packageJson from "../package.json" with { type: "json" };
import {
  type DeviceCode,
  parseInput,
  pollDeviceToken,
  requestDeviceCode,
  serverUrl,
  sessionUser,
  signOut,
  TodoApi,
} from "./api";
import {
  credentialsFile,
  deleteToken,
  readToken,
  writeToken,
} from "./credentials";
import { CliError, exitCodesHelp } from "./errors";
import { todoDetails, todoLine, todoList, userLine } from "./format";

// The todo-cat CLI: one command per REST use case, plus login, logout and whoami.
// Results go to stdout (text, or JSON with --json); errors go to stderr; nothing ever prompts.

const program = new Command("todo-cat");

function jsonOutput(): boolean {
  return program.opts().json === true || process.argv.includes("--json");
}

/** Prints a command's result: the data itself as JSON with --json, else the readable text. */
function print(data: unknown, text: string) {
  process.stdout.write(
    jsonOutput() ? `${JSON.stringify(data, null, 2)}\n` : `${text}\n`,
  );
}

function examples(...lines: string[]) {
  return `\nExamples:\n${lines.map((line) => `  $ ${line}`).join("\n")}`;
}

async function savedToken(server: string): Promise<string> {
  const token = await readToken(server);
  if (!token) {
    throw new CliError(
      "not-logged-in",
      `Not logged in to ${server}; run \`todo-cat login\``,
    );
  }
  return token;
}

async function todoApi(): Promise<TodoApi> {
  const server = serverUrl();
  return new TodoApi(server, await savedToken(server));
}

/** Polls at the server's interval until the code is approved, denied, or expires. */
async function waitForApproval(server: string, code: DeviceCode) {
  const deadline = Date.now() + code.expires_in * 1000;
  let interval = code.interval * 1000;
  const expired = new CliError(
    "login-expired",
    "The code expired before it was approved; run `todo-cat login` again",
  );
  while (Date.now() < deadline) {
    await sleep(interval);
    const result = await pollDeviceToken(server, code.device_code);
    if ("token" in result) return result.token;
    switch (result.error) {
      case "authorization_pending":
        break;
      case "slow_down":
        interval += 5000;
        break;
      case "access_denied":
        throw new CliError(
          "login-denied",
          "The login was denied in the browser",
        );
      case "expired_token":
        throw expired;
      default:
        throw new CliError(
          "unexpected-response",
          `The server refused the device login: ${result.error}`,
        );
    }
  }
  throw expired;
}

program
  .description(
    "Your todos, kept by Lissie: a client of the todo-cat REST API, for AI agents and the humans they work for.",
  )
  .version(packageJson.version)
  .option(
    "--json",
    "print results as JSON on stdout, and errors as JSON on stderr",
  )
  // Inherited by every command added below: errors are printed by main(), not by Commander.
  .exitOverride()
  .configureOutput({ outputError: () => {} })
  .addHelpText(
    "after",
    () => `${examples(
      "todo-cat login",
      'todo-cat add "Buy tuna" --due 2026-10-31',
      "todo-cat list --status all --json",
      "todo-cat done 6f1c2a3e-…",
      "todo-cat delete 6f1c2a3e-… --yes",
    )}

Output:
  Results go to stdout as text, or with --json as the REST API's JSON (todo objects).
  Errors go to stderr as "error (<code>): <message>", or with --json as
  {"error":{"code":"<code>","message":"<message>"}}. Nothing ever prompts.

Environment:
  TODO_CAT_URL     the server (default http://localhost:3000)
  XDG_CONFIG_HOME  where the config directory lives; the session token is kept,
                   readable by you only, in ${credentialsFile()}

${exitCodesHelp()}`,
  );

program
  .command("login")
  .description(
    "log in: prints a code to approve in the browser, then waits until it is approved (never opens a browser)",
  )
  .addHelpText(
    "after",
    `
The code and the page to enter it on are printed to stderr right away. Run this in the
background if you are an agent, and pass both on to your human; the command finishes
once they approve the code while signed in to todo-cat, or fails when it expires.
${examples("todo-cat login", "TODO_CAT_URL=https://todo.example.com todo-cat login --json")}`,
  )
  .action(async () => {
    const server = serverUrl();
    const code = await requestDeviceCode(server);
    process.stderr.write(
      `To log in, open ${code.verification_uri} in a browser where you are signed in to todo-cat,\n` +
        `and enter the code ${formatUserCode(code.user_code)}. Waiting for approval ` +
        `(the code expires in ${Math.round(code.expires_in / 60)} minutes)...\n`,
    );
    const token = await waitForApproval(server, code);
    const user = await sessionUser(server, token);
    if (!user) {
      throw new CliError(
        "unexpected-response",
        "The server issued a session it does not accept",
      );
    }
    const previous = await readToken(server);
    await writeToken(server, token);
    // The session this login replaces is ended too; it is only a stale token now.
    if (previous && previous !== token) {
      await signOut(server, previous).catch(() => {});
    }
    print({ server, user }, userLine(server, user));
  });

program
  .command("logout")
  .description("end the session on the server and delete the saved token")
  .addHelpText("after", examples("todo-cat logout"))
  .action(async () => {
    const server = serverUrl();
    const token = await readToken(server);
    if (!token) {
      print(
        { server, loggedOut: false },
        `Not logged in to ${server}; nothing to do.`,
      );
      return;
    }
    // Revoke first: if the server is unreachable, the token stays so logout can be retried.
    await signOut(server, token);
    await deleteToken(server);
    print({ server, loggedOut: true }, `Logged out of ${server}.`);
  });

program
  .command("whoami")
  .description("show who you are logged in as, and on which server")
  .addHelpText("after", examples("todo-cat whoami", "todo-cat whoami --json"))
  .action(async () => {
    const server = serverUrl();
    const user = await sessionUser(server, await savedToken(server));
    if (!user) {
      throw new CliError(
        "unauthorized",
        `The server no longer accepts your session at ${server}; run \`todo-cat login\``,
      );
    }
    print({ server, user }, userLine(server, user));
  });

program
  .command("list")
  .alias("ls")
  .description("list your todos: open ones first, then by due date")
  .addOption(
    new Option(
      "-s, --status <status>",
      "which todos to list: open (the default), done, or all",
    ).choices(todoStatusSchema.options),
  )
  .option("-q, --search <text>", "only todos whose title contains this text")
  .addHelpText(
    "after",
    examples(
      "todo-cat list",
      "todo-cat list --status all",
      "todo-cat list --search tuna --json",
    ),
  )
  .action(async (options: { status?: string; search?: string }) => {
    const filter = parseInput(todoListFilterSchema, {
      status: options.status,
      q: options.search,
    });
    const todos = await (await todoApi()).list(filter);
    print(todos, todoList(todos, filter.status));
  });

program
  .command("show")
  .description("show one todo")
  .argument("<id>", "the todo's id")
  .addHelpText("after", examples("todo-cat show 6f1c2a3e-… --json"))
  .action(async (id: string) => {
    const todo = await (await todoApi()).get(id);
    print(todo, todoDetails(todo));
  });

program
  .command("add")
  .description("add a todo")
  .argument("<title...>", "what to do; several words are joined with spaces")
  .option("-d, --due <date>", "due date, yyyy-mm-dd")
  .addHelpText(
    "after",
    examples(
      'todo-cat add "Buy tuna"',
      "todo-cat add Book the vet --due 2026-10-31 --json",
    ),
  )
  .action(async (words: string[], options: { due?: string }) => {
    const input = parseInput(newTodoSchema, {
      title: words.join(" "),
      dueDate: options.due,
    });
    const todo = await (await todoApi()).add(input);
    print(todo, `Added ${todoLine(todo)}`);
  });

program
  .command("edit")
  .description("change a todo's title or due date")
  .argument("<id>", "the todo's id")
  .option("-t, --title <title>", "the new title")
  .option("-d, --due <date>", "the new due date, yyyy-mm-dd")
  .option("--no-due", "remove the due date")
  .addHelpText(
    "after",
    examples(
      'todo-cat edit 6f1c2a3e-… --title "Buy salmon"',
      "todo-cat edit 6f1c2a3e-… --due 2026-11-01",
      "todo-cat edit 6f1c2a3e-… --no-due",
    ),
  )
  .action(
    async (id: string, options: { title?: string; due?: string | false }) => {
      if (options.title === undefined && options.due === undefined) {
        throw new CliError(
          "usage",
          "Nothing to change; pass --title, --due or --no-due",
        );
      }
      const input = parseInput(todoUpdateSchema, {
        title: options.title,
        dueDate: options.due === false ? null : options.due,
      });
      const todo = await (await todoApi()).update(id, input);
      print(todo, `Updated ${todoLine(todo)}`);
    },
  );

program
  .command("done")
  .description("mark a todo as done")
  .argument("<id>", "the todo's id")
  .addHelpText("after", examples("todo-cat done 6f1c2a3e-…"))
  .action(async (id: string) => {
    const todo = await (await todoApi()).update(id, { done: true });
    print(todo, `Done ${todoLine(todo)}`);
  });

program
  .command("reopen")
  .description("mark a done todo as open again")
  .argument("<id>", "the todo's id")
  .addHelpText("after", examples("todo-cat reopen 6f1c2a3e-…"))
  .action(async (id: string) => {
    const todo = await (await todoApi()).update(id, { done: false });
    print(todo, `Reopened ${todoLine(todo)}`);
  });

program
  .command("delete")
  .description("delete a todo for good; needs --yes")
  .argument("<id>", "the todo's id")
  .option("-y, --yes", "confirm the deletion; it cannot be undone")
  .addHelpText("after", examples("todo-cat delete 6f1c2a3e-… --yes"))
  .action(async (id: string, options: { yes?: boolean }) => {
    if (!options.yes) {
      throw new CliError(
        "confirmation-required",
        "Deleting cannot be undone; pass --yes to confirm",
      );
    }
    await (await todoApi()).delete(id);
    print({ id, deleted: true }, `Deleted ${id}.`);
  });

function toCliError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  if (error instanceof CommanderError) {
    // Commander has printed the help to stderr already.
    if (error.code === "commander.help") {
      return new CliError(
        "usage",
        "Missing a command; pick one from the list above",
      );
    }
    return new CliError("usage", error.message.replace(/^error: /, ""));
  }
  const message = error instanceof Error ? error.message : String(error);
  return new CliError("internal-error", message);
}

async function main() {
  try {
    await program.parseAsync();
  } catch (error) {
    // --help and --version end in a CommanderError too, after printing what was asked for.
    if (error instanceof CommanderError && error.exitCode === 0) return;
    const { code, message, exitCode } = toCliError(error);
    process.stderr.write(
      jsonOutput()
        ? `${JSON.stringify({ error: { code, message } })}\n`
        : `error (${code}): ${message}\n`,
    );
    process.exitCode = exitCode;
  }
}

await main();
