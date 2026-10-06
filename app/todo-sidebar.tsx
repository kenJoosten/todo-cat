import type { Todo } from "@todo-cat/contract";
import { TodoList } from "@/components/ui/todo-list";

// The user's list next to the chat, read-only: Lissie is the browser's only write path for
// now. A server component; the chat refreshes the page's server data after each change
// she makes, which renders this again (see app/lissie-tool-calls.tsx).
export function TodoSidebar({ todos }: { todos: Todo[] }) {
  return (
    <aside
      aria-label="Your list"
      className="flex flex-col gap-6 rounded-md border border-line bg-white/60 p-5 lg:max-h-[32rem] lg:overflow-y-auto"
    >
      <TodoList
        title="Open"
        todos={todos.filter((todo) => !todo.done)}
        empty="Nothing open. Ask Lissie to add something."
      />
      <TodoList
        title="Done"
        todos={todos.filter((todo) => todo.done)}
        empty="Nothing done yet. Lissie has noticed."
      />
    </aside>
  );
}
