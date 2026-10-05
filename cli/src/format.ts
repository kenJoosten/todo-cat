import type { Todo, TodoStatus } from "@todo-cat/contract";
import type { User } from "./api";

// The readable text for each result; --json prints the result objects themselves instead.

export function todoLine(todo: Todo): string {
  const due = todo.dueDate ? `  (due ${todo.dueDate})` : "";
  return `${todo.done ? "[x]" : "[ ]"} ${todo.id}  ${todo.title}${due}`;
}

export function todoList(todos: Todo[], status: TodoStatus): string {
  if (todos.length === 0) {
    return status === "all" ? "No todos." : `No ${status} todos.`;
  }
  return todos.map(todoLine).join("\n");
}

export function todoDetails(todo: Todo): string {
  return [
    todo.title,
    `  id:      ${todo.id}`,
    `  status:  ${todo.done ? `done at ${todo.completedAt}` : "open"}`,
    `  due:     ${todo.dueDate ?? "no due date"}`,
    `  created: ${todo.createdAt}`,
  ].join("\n");
}

export function userLine(server: string, user: User): string {
  return `Logged in to ${server} as ${user.name} <${user.email}>.`;
}
