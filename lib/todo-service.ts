import "server-only";
import type {
  NewTodo,
  Todo,
  TodoListFilter,
  TodoUpdate,
} from "@todo-cat/contract";
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import { db } from "./db";
import { todos } from "./schema";

// The todo use cases; the only module that touches the todos table.
// Every function takes the owner's user id first and every query filters by it.
// Inputs are trusted contract types: adapters parse them with the contract schemas first.

/** The todo does not exist or belongs to someone else; callers can't tell which. */
export class TodoNotFoundError extends Error {
  readonly code = "todo-not-found";

  constructor(id: string) {
    super(`No todo with id ${id}`);
    this.name = "TodoNotFoundError";
  }
}

// Every column except the owner, which never leaves the service.
const todoColumns = {
  id: todos.id,
  title: todos.title,
  dueDate: todos.dueDate,
  done: todos.done,
  createdAt: todos.createdAt,
  completedAt: todos.completedAt,
};

type TodoRow = Omit<typeof todos.$inferSelect, "userId">;

function toTodo(row: TodoRow): Todo {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function owned(userId: string, id: string) {
  return and(eq(todos.userId, userId), eq(todos.id, id));
}

/** Open todos first, then by due date (soonest first, none last), then newest first. */
export async function listTodos(
  userId: string,
  filter: TodoListFilter,
): Promise<Todo[]> {
  const conditions: SQL[] = [eq(todos.userId, userId)];
  if (filter.status !== "all") {
    conditions.push(eq(todos.done, filter.status === "done"));
  }
  if (filter.q) {
    // instr instead of like, so % and _ in the search text match literally.
    conditions.push(sql`instr(lower(${todos.title}), lower(${filter.q})) > 0`);
  }
  const rows = await db
    .select(todoColumns)
    .from(todos)
    .where(and(...conditions))
    .orderBy(
      asc(todos.done),
      sql`${todos.dueDate} is null`,
      asc(todos.dueDate),
      desc(todos.createdAt),
      asc(todos.id),
    );
  return rows.map(toTodo);
}

export async function getTodo(userId: string, id: string): Promise<Todo> {
  const [row] = await db
    .select(todoColumns)
    .from(todos)
    .where(owned(userId, id));
  if (!row) throw new TodoNotFoundError(id);
  return toTodo(row);
}

export async function addTodo(userId: string, input: NewTodo): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({
      id: crypto.randomUUID(),
      userId,
      title: input.title,
      dueDate: input.dueDate,
      createdAt: new Date(),
    })
    .returning(todoColumns);
  return toTodo(row);
}

/** Marking a todo done sets `completedAt` (kept if it was already done); reopening clears it. */
export async function updateTodo(
  userId: string,
  id: string,
  input: TodoUpdate,
): Promise<Todo> {
  const changes: Partial<typeof todos.$inferInsert> = {};
  if (input.title !== undefined) changes.title = input.title;
  if (input.dueDate !== undefined) changes.dueDate = input.dueDate;
  if (input.done === false) {
    changes.done = false;
    changes.completedAt = null;
  }
  const set =
    input.done === true
      ? {
          ...changes,
          done: true,
          completedAt: sql`coalesce(${todos.completedAt}, ${Date.now()})`,
        }
      : changes;
  if (Object.keys(set).length === 0) return getTodo(userId, id);

  const [row] = await db
    .update(todos)
    .set(set)
    .where(owned(userId, id))
    .returning(todoColumns);
  if (!row) throw new TodoNotFoundError(id);
  return toTodo(row);
}

export async function deleteTodo(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(todos)
    .where(owned(userId, id))
    .returning({ id: todos.id });
  if (deleted.length === 0) throw new TodoNotFoundError(id);
}

/** A todo with its history, for the dev seed. */
export type SeedTodo = NewTodo & {
  createdAt: Date;
  completedAt: Date | null;
};

/**
 * Replaces all of the user's todos with the given ones, in one transaction.
 * Only for the dev seed (`npm run db:seed`), which needs past timestamps; no adapter exposes it.
 */
export async function replaceTodos(
  userId: string,
  seed: SeedTodo[],
): Promise<Todo[]> {
  return db.transaction(async (tx) => {
    await tx.delete(todos).where(eq(todos.userId, userId));
    if (seed.length === 0) return [];
    const rows = await tx
      .insert(todos)
      .values(
        seed.map((todo) => ({
          id: crypto.randomUUID(),
          userId,
          title: todo.title,
          dueDate: todo.dueDate,
          done: todo.completedAt !== null,
          createdAt: todo.createdAt,
          completedAt: todo.completedAt,
        })),
      )
      .returning(todoColumns);
    return rows.map(toTodo);
  });
}
