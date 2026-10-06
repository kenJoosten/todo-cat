import type { Todo } from "@todo-cat/contract";
import { useId } from "react";
import { dueDateLabel } from "@/lib/due-date";

// A titled, read-only list of todos with their count and due dates; done ones are struck through.
export function TodoList({
  title,
  todos,
  empty,
}: {
  title: string;
  todos: Todo[];
  empty: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="flex items-baseline justify-between text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {title}
        <span className="tabular-nums"> {todos.length}</span>
      </h2>
      {todos.length === 0 ? (
        <p className="mt-2 text-sm text-pretty text-muted">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-baseline justify-between gap-3 py-2 text-sm"
            >
              <span
                className={
                  todo.done ? "text-muted line-through decoration-line" : ""
                }
              >
                {todo.title}
              </span>
              {todo.dueDate && (
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {dueDateLabel(todo.dueDate)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
