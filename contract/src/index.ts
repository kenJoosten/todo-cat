// The todo-cat contract: the shapes the server and its clients agree on.
// Adapters parse every input with these schemas; clients parse every response with them.
import { z } from "zod";

/** A calendar date without time, `yyyy-mm-dd`; never converted to a JavaScript Date. */
export const isoDateSchema = z.iso.date();

const titleSchema = z.string().trim().min(1).max(200);

export const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: isoDateSchema.nullable(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  /** Set when the todo is marked done, null while it is open. */
  completedAt: z.iso.datetime().nullable(),
});
export type Todo = z.infer<typeof todoSchema>;

export const newTodoSchema = z.object({
  title: titleSchema,
  dueDate: isoDateSchema.nullable().default(null),
});
export type NewTodo = z.output<typeof newTodoSchema>;

/** Only the fields present change; `dueDate: null` removes the due date. */
export const todoUpdateSchema = z.object({
  title: titleSchema.optional(),
  dueDate: isoDateSchema.nullable().optional(),
  done: z.boolean().optional(),
});
export type TodoUpdate = z.output<typeof todoUpdateSchema>;

export const todoStatusSchema = z.enum(["open", "done", "all"]);
export type TodoStatus = z.infer<typeof todoStatusSchema>;

export const todoListFilterSchema = z.object({
  status: todoStatusSchema.default("open"),
  /** Case-insensitive text the title must contain. */
  q: z.string().trim().min(1).optional(),
});
export type TodoListFilter = z.output<typeof todoListFilterSchema>;

export const errorCodeSchema = z.enum([
  "unauthorized",
  "todo-not-found",
  "validation-failed",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** The body of every error response. */
export const errorBodySchema = z.object({
  error: z.object({ code: errorCodeSchema, message: z.string() }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;
