import type { Todo } from "@todo-cat/contract";

/**
 * The order within the list's Open or Done section, the one `listTodos` sorts by after
 * done: soonest due first, no due date last, then newest first. The list on / sorts its
 * optimistic rows with it, so a row it adds lands where the server will put it.
 */
export function compareInSection(a: Todo, b: Todo): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The order of `listTodos`: open before done, then `compareInSection`. */
export function compareTodos(a: Todo, b: Todo): number {
  return Number(a.done) - Number(b.done) || compareInSection(a, b);
}
