// The shapes of Lissie's todo tools, shared by the tools (lib/lissie/todo-tools.ts) and the
// chat that renders their calls. Built from the contract, so the model is held to the same
// rules as every other client. No tool takes a user id: the server supplies the owner.
import {
  errorBodySchema,
  isoDateSchema,
  newTodoSchema,
  todoListFilterSchema,
  todoListSchema,
  todoSchema,
} from "@todo-cat/contract";
import { z } from "zod";

export const listTodosInput = todoListFilterSchema.extend({
  status: todoListFilterSchema.shape.status.describe(
    "open (the default), done, or all",
  ),
  q: todoListFilterSchema.shape.q.describe(
    "Only todos whose title contains this text, ignoring case",
  ),
});
export const listTodosOutput = z.object({ todos: todoListSchema });

export const addTodoInput = newTodoSchema.extend({
  dueDate: isoDateSchema
    .nullable()
    .default(null)
    .describe("The due date as yyyy-mm-dd, or null for none"),
});
export const addTodoOutput = z.object({ todo: todoSchema });

export const setTodoDoneInput = z.object({
  id: z.string().min(1).describe("The todo's id, from listTodos"),
  done: z.boolean().describe("true marks it done, false reopens it"),
});
/** The changed todo, or `todo-not-found` when the id is not one of the user's todos. */
export const setTodoDoneOutput = z.union([
  z.object({ todo: todoSchema }),
  errorBodySchema,
]);

export const showProgressInput = z.object({});
/**
 * The A2UI operations that draw the progress card (lib/lissie/progress-card.ts); the chat
 * renders them, and the model reads the counts from the data model they set.
 */
export const showProgressOutput = z.object({
  a2ui_operations: z.array(z.record(z.string(), z.unknown())).min(1),
});

/** The tools' names as the model and the chat see them. */
export const todoToolNames = [
  "listTodos",
  "addTodo",
  "setTodoDone",
  "showProgress",
] as const;
export type TodoToolName = (typeof todoToolNames)[number];

/** The tools that change the list, so the sidebar refreshes after their calls. */
export const todoWriteToolNames: readonly TodoToolName[] = [
  "addTodo",
  "setTodoDone",
];
