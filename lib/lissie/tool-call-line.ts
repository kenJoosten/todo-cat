// What the chat shows for one of Lissie's tool calls: a single readable line, never JSON.
// The result is the tool's output as the bridge streams it (and the history replays it):
// a JSON string, parsed with the tools' own schemas.
import type { z } from "zod";
import { dueDateLabel } from "../due-date";
import {
  addTodoInput,
  addTodoOutput,
  listTodosInput,
  listTodosOutput,
  setTodoDoneInput,
  setTodoDoneOutput,
} from "./todo-tool-schemas";

export type ToolCallLine = {
  text: string;
  /** Running until the result is in; failed when the tool refused or found nothing. */
  state: "running" | "done" | "failed";
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  return schema.safeParse(value).data;
}

function parseResult<T>(schema: z.ZodType<T>, result: string): T | undefined {
  try {
    return parse(schema, JSON.parse(result));
  } catch {
    return undefined;
  }
}

function quoted(title: string) {
  return `“${title}”`;
}

function listLine(
  parameters: unknown,
  result: string | undefined,
): ToolCallLine {
  const filter = parse(listTodosInput, parameters ?? {});
  const which = { open: "open todos", done: "done todos", all: "todos" }[
    filter?.status ?? "open"
  ];
  const what = filter?.q
    ? `Searched your ${which} for ${quoted(filter.q)}`
    : `Looked at your ${which}`;
  if (result === undefined) return { text: `${what}…`, state: "running" };
  const output = parseResult(listTodosOutput, result);
  if (!output) return { text: "Couldn't look at your list", state: "failed" };
  const count = output.todos.length;
  return { text: `${what} (${count || "none"})`, state: "done" };
}

function addLine(
  parameters: unknown,
  result: string | undefined,
): ToolCallLine {
  const title = parse(addTodoInput.pick({ title: true }), parameters)?.title;
  const todo = title ? ` ${quoted(title)}` : " a todo";
  if (result === undefined) return { text: `Adding${todo}…`, state: "running" };
  const added = parseResult(addTodoOutput, result)?.todo;
  if (!added) return { text: `Couldn't add${todo}`, state: "failed" };
  const due = added.dueDate ? `, due ${dueDateLabel(added.dueDate)}` : "";
  return { text: `Added ${quoted(added.title)}${due}`, state: "done" };
}

function doneLine(
  parameters: unknown,
  result: string | undefined,
): ToolCallLine {
  const done = parse(setTodoDoneInput, parameters)?.done ?? true;
  if (result === undefined) {
    return {
      text: done ? "Marking a todo done…" : "Reopening a todo…",
      state: "running",
    };
  }
  const output = parseResult(setTodoDoneOutput, result);
  if (!output || "error" in output) {
    return { text: "Couldn't find that todo", state: "failed" };
  }
  const title = quoted(output.todo.title);
  return output.todo.done
    ? { text: `Marked ${title} done`, state: "done" }
    : { text: `Reopened ${title}`, state: "done" };
}

/** The line for a call to `name` with `parameters`; `result` is undefined while it runs. */
export function toolCallLine(
  name: string,
  parameters: unknown,
  result: string | undefined,
): ToolCallLine {
  switch (name) {
    case "listTodos":
      return listLine(parameters, result);
    case "addTodo":
      return addLine(parameters, result);
    case "setTodoDone":
      return doneLine(parameters, result);
    default:
      return {
        text: result === undefined ? `Using ${name}…` : `Used ${name}`,
        state: result === undefined ? "running" : "done",
      };
  }
}
