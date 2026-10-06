"use server";

// The list on / changes todos through these Server Actions: one more thin adapter on the
// todo service (tech-docs/architecture.md). Each resolves the user from the session first,
// then parses its input with the contract, calls the service, and maps errors to the
// contract's codes. On success it refreshes the page, so the list renders the service's state.
import {
  type ErrorBody,
  newTodoSchema,
  todoUpdateSchema,
} from "@todo-cat/contract";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import {
  addTodo,
  deleteTodo,
  TodoNotFoundError,
  updateTodo,
} from "@/lib/todo-service";

/** Nothing on success; the contract's error body when the change didn't happen. */
export type TodoActionResult = Partial<ErrorBody>;

const idSchema = z.string().min(1);

function failure(
  code: ErrorBody["error"]["code"],
  message: string,
): TodoActionResult {
  return { error: { code, message } };
}

async function asUser<T>(
  schema: z.ZodType<T>,
  input: unknown,
  change: (userId: string, input: T) => Promise<unknown>,
): Promise<TodoActionResult> {
  const userId = await getUserId(await headers());
  if (!userId) {
    return failure(
      "unauthorized",
      "You're signed out. Sign in to change your list.",
    );
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return failure(
      "validation-failed",
      "A todo needs a title of up to 200 characters, and a due date if any as a date.",
    );
  }
  try {
    await change(userId, parsed.data);
  } catch (error) {
    if (!(error instanceof TodoNotFoundError)) throw error;
    // Gone already: refresh anyway, so the list stops showing it.
    refresh();
    return failure(error.code, "That todo isn't on your list anymore.");
  }
  refresh();
  return {};
}

export async function addTodoAction(input: unknown) {
  return asUser(newTodoSchema, input, addTodo);
}

export async function setTodoDoneAction(id: unknown, done: unknown) {
  return asUser(
    z.object({ id: idSchema, done: todoUpdateSchema.shape.done.unwrap() }),
    { id, done },
    (userId, change) => updateTodo(userId, change.id, { done: change.done }),
  );
}

export async function deleteTodoAction(id: unknown) {
  return asUser(idSchema, id, deleteTodo);
}
