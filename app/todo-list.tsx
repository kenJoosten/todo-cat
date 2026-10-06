"use client";

import type { Todo } from "@todo-cat/contract";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClawMarks } from "@/components/ui/claw-marks";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import { dueDateLabel } from "@/lib/due-date";
import {
  addTodoAction,
  deleteTodoAction,
  setTodoDoneAction,
  type TodoActionResult,
} from "./todo-actions";

// The user's list on /: add, check off, reopen and delete, through the Server Actions in
// ./todo-actions.ts. `todos` comes from the server; a change shows at once (optimistically)
// and the action's refresh then renders the service's state, as does a change Lissie makes.

type Change =
  | { type: "add"; todo: Todo }
  | { type: "done"; id: string; done: boolean }
  | { type: "delete"; id: string };

function applyChange(todos: Todo[], change: Change): Todo[] {
  switch (change.type) {
    case "add":
      return [change.todo, ...todos];
    case "done":
      return todos.map((todo) =>
        todo.id === change.id
          ? {
              ...todo,
              done: change.done,
              completedAt: change.done ? new Date().toISOString() : null,
            }
          : todo,
      );
    case "delete":
      return todos.filter((todo) => todo.id !== change.id);
  }
}

/** A todo added here that the server hasn't confirmed yet. */
const pendingPrefix = "pending-";

const noSubscription = () => () => {};

/** Today in the browser's time zone as yyyy-mm-dd; null while rendering on the server. */
function useToday() {
  return useSyncExternalStore(
    noSubscription,
    () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    },
    () => null,
  );
}

function DueDate({
  date,
  today,
  done,
}: {
  date: string;
  today: string | null;
  done: boolean;
}) {
  const overdue = !done && today !== null && date < today;
  const label = date === today ? "Today" : dueDateLabel(date);
  return (
    <span
      className={`shrink-0 text-sm tabular-nums ${overdue ? "font-semibold text-danger" : date === today ? "font-semibold text-ink" : "text-muted"}`}
    >
      {label}
      {overdue && <span className="sr-only">, overdue</span>}
    </span>
  );
}

function TodoRow({
  todo,
  today,
  live,
  onDone,
  onDelete,
}: {
  todo: Todo;
  today: string | null;
  /** Rows that appear after the list first rendered swipe their claw marks in. */
  live: boolean;
  onDone: (done: boolean) => void;
  onDelete: () => void;
}) {
  const [swipe] = useState(live);
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  const checkboxId = useId();
  const pending = todo.id.startsWith(pendingPrefix);

  // The safe choice takes focus when the question appears, and the delete button gets it
  // back when the question goes away.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (asked.current) deleteRef.current?.focus();
    asked.current = confirming;
  }, [confirming]);

  const escapeKeeps = (event: KeyboardEvent) => {
    if (event.key === "Escape") setConfirming(false);
  };

  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-line py-2">
      <Checkbox
        id={checkboxId}
        checked={todo.done}
        disabled={pending}
        onChange={(event) => onDone(event.target.checked)}
      />
      <label
        htmlFor={checkboxId}
        className={`min-w-0 flex-1 cursor-pointer text-pretty ${todo.done ? "text-muted" : ""}`}
      >
        <span className="relative inline-block">
          {todo.title}
          {todo.done && <ClawMarks swipe={swipe} />}
        </span>
      </label>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-muted">Delete it?</span>
          <Button
            variant="danger"
            size="small"
            onClick={onDelete}
            onKeyDown={escapeKeeps}
          >
            Delete
          </Button>
          <Button
            ref={keepRef}
            variant="secondary"
            size="small"
            onClick={() => setConfirming(false)}
            onKeyDown={escapeKeeps}
          >
            Keep
          </Button>
        </div>
      ) : (
        <>
          {todo.dueDate && (
            <DueDate date={todo.dueDate} today={today} done={todo.done} />
          )}
          <Button
            ref={deleteRef}
            variant="quiet"
            size="icon"
            aria-label={`Delete “${todo.title}”`}
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-4 fill-none stroke-current stroke-[1.75]"
            >
              <path
                d="M4 6h12M8 6V4h4v2m-6.5 0 .8 10h7.4l.8-10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </>
      )}
    </li>
  );
}

function Section({
  title,
  todos,
  empty,
  children,
}: {
  title: string;
  todos: Todo[];
  empty: string;
  children: (todo: Todo) => ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} count={todos.length}>
        {title}
      </SectionHeading>
      {todos.length === 0 ? (
        <p className="mt-3 text-pretty text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 border-t border-line">{todos.map(children)}</ul>
      )}
    </section>
  );
}

export function TodoList({ todos }: { todos: Todo[] }) {
  const [shown, show] = useOptimistic(todos, applyChange);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const today = useToday();
  // False for the rows of the first render, so only todos done while you watch swipe.
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);

  function change(next: Change, action: () => Promise<TodoActionResult>) {
    setError(undefined);
    startTransition(async () => {
      show(next);
      const result = await action();
      if (result.error) setError(result.error.message);
    });
  }

  async function add(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "") || null;
    if (!title) return;
    setError(undefined);
    show({
      type: "add",
      todo: {
        id: `${pendingPrefix}${crypto.randomUUID()}`,
        title,
        dueDate,
        done: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    });
    const result = await addTodoAction({ title, dueDate });
    if (result.error) setError(result.error.message);
  }

  const row = (todo: Todo) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      today={today}
      live={live}
      onDone={(done) =>
        change({ type: "done", id: todo.id, done }, () =>
          setTodoDoneAction(todo.id, done),
        )
      }
      onDelete={() =>
        change({ type: "delete", id: todo.id }, () => deleteTodoAction(todo.id))
      }
    />
  );

  return (
    <div className="flex flex-col gap-10">
      <form action={add} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[1_1_16rem]">
          <Field
            label="New todo"
            name="title"
            required
            maxLength={200}
            autoComplete="off"
            placeholder="What needs doing?"
          />
        </div>
        <Field label="Due (optional)" name="dueDate" type="date" />
        <SubmitButton>Add</SubmitButton>
      </form>
      <FormError message={error} />
      <Section
        title="Open"
        todos={shown.filter((todo) => !todo.done)}
        empty="Nothing open. Add a todo above, or tell Lissie what's on your mind."
      >
        {row}
      </Section>
      <Section
        title="Done"
        todos={shown.filter((todo) => todo.done)}
        empty="Nothing done yet. Lissie has noticed."
      >
        {row}
      </Section>
    </div>
  );
}
