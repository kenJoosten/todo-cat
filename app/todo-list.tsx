"use client";

import type { Todo } from "@todo-cat/contract";
import {
  type ReactNode,
  type RefObject,
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
import { Confirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import { dueDateLabel } from "@/lib/due-date";
import { compareInSection } from "@/lib/todo-order";
import {
  addTodoAction,
  deleteTodoAction,
  setTodoDoneAction,
  type TodoActionResult,
} from "./todo-actions";

// The user's list on /: add, check off, reopen and delete, through the Server Actions in
// ./todo-actions.ts. `todos` comes from the server; a change shows at once (optimistically)
// and the action's refresh then renders the service's state, as does a change Lissie makes.
// A row checked off or reopened stays where it is while its claw marks draw or lift, then
// moves to its section; focus moves to the row next to it, never to the page.

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

/**
 * How long a row whose done state changed stays put before it moves to its section: the
 * claw marks take about a third of a second to draw, then a beat to see them.
 */
const settleMs = 900;

/**
 * Before `row` leaves its list, moves focus from inside it to the same control in the row
 * after it (or before it), or to the section when it was the only row.
 */
function handOffFocus(row: Element | null) {
  const focused = document.activeElement;
  if (!row || !focused || !row.contains(focused)) return;
  // Focus inside the row but on no control is on its delete question.
  const control =
    focused.closest<HTMLElement>("[data-row-control]")?.dataset.rowControl ??
    "delete";
  const selector = `[data-row-control="${control}"]`;
  const next = [row.nextElementSibling, row.previousElementSibling]
    .map((sibling) => sibling?.querySelector<HTMLElement>(selector))
    .find(Boolean);
  (next ?? row.closest<HTMLElement>("section"))?.focus();
}

function rowElement(list: RefObject<HTMLElement | null>, id: string) {
  return (
    list.current?.querySelector(`[data-todo-row="${CSS.escape(id)}"]`) ?? null
  );
}

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

// Beside the title from `sm` up; under it on phones, where the title needs the width.
const dueDatePlacement = {
  beside: "mt-3 hidden shrink-0 sm:block",
  below: "mt-0.5 block sm:hidden",
};

function DueDate({
  date,
  today,
  done,
  placement,
}: {
  date: string;
  today: string | null;
  done: boolean;
  placement: keyof typeof dueDatePlacement;
}) {
  const overdue = !done && today !== null && date < today;
  const label = date === today ? "Today" : dueDateLabel(date);
  return (
    <span
      className={`${dueDatePlacement[placement]} text-sm tabular-nums ${overdue ? "font-semibold text-danger" : date === today ? "font-semibold text-ink" : "text-muted"}`}
    >
      {overdue ? `Overdue · ${label}` : label}
    </span>
  );
}

function TodoRow({
  todo,
  today,
  onDone,
  onDelete,
}: {
  todo: Todo;
  today: string | null;
  onDone: (done: boolean) => void;
  onDelete: () => void;
}) {
  // The claw marks swipe in only when the todo is checked off while the row is on screen,
  // by the user or by Lissie; a row that arrives done shows them still.
  const [wasDone, setWasDone] = useState(todo.done);
  const [swipe, setSwipe] = useState(false);
  if (todo.done !== wasDone) {
    setWasDone(todo.done);
    setSwipe(todo.done);
  }
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  const pending = todo.id.startsWith(pendingPrefix);
  const checkboxId = useId();

  // The delete button gets focus back when the question goes away.
  useEffect(() => {
    if (!confirming && asked.current) deleteRef.current?.focus();
    asked.current = confirming;
  }, [confirming]);

  // The title and the checkbox share one label, so the whole line is the hit area; the
  // row wraps the confirm question below the title when they don't fit side by side.
  return (
    <li
      data-todo-row={todo.id}
      className="flex flex-wrap items-start gap-x-3 border-b border-line py-1.5"
    >
      <label
        htmlFor={checkboxId}
        className={`flex min-w-[min(10rem,100%)] flex-1 cursor-pointer items-start gap-3 py-2.5 ${todo.done ? "text-muted" : ""}`}
      >
        <span className="pt-0.5">
          <Checkbox
            id={checkboxId}
            data-row-control="check"
            checked={todo.done}
            disabled={pending}
            onChange={(event) => onDone(event.target.checked)}
          />
        </span>
        <span className="min-w-0">
          <span className="relative inline-block text-pretty">
            {todo.title}
            {todo.done && <ClawMarks swipe={swipe} />}
          </span>
          {todo.dueDate && !todo.done && (
            <DueDate
              date={todo.dueDate}
              today={today}
              done={todo.done}
              placement="below"
            />
          )}
        </span>
      </label>
      {confirming ? (
        <div className="ml-auto flex min-h-11 items-center">
          <Confirm
            question={
              <>
                Delete it?<span className="sr-only"> {todo.title}</span>
              </>
            }
            action="Delete"
            onConfirm={onDelete}
            onKeep={() => setConfirming(false)}
          />
        </div>
      ) : (
        <>
          {todo.dueDate && !todo.done && (
            <DueDate
              date={todo.dueDate}
              today={today}
              done={todo.done}
              placement="beside"
            />
          )}
          <span className="-mr-2.5">
            <Button
              ref={deleteRef}
              data-row-control="delete"
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
          </span>
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
  // Focusable from script only: focus lands here when its last row leaves.
  return (
    <section
      aria-labelledby={headingId}
      tabIndex={-1}
      className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <SectionHeading id={headingId} count={todos.length}>
        {title}
      </SectionHeading>
      {todos.length === 0 ? (
        <p className="mt-3 text-pretty text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 border-t border-line">{todos.map(children)}</ul>
      )}
    </section>
  );
}

export function TodoList({ todos }: { todos: Todo[] }) {
  const [shown, show] = useOptimistic(todos, applyChange);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const today = useToday();
  const listRef = useRef<HTMLDivElement>(null);

  // The section each row sits in: open or done as it was when the row arrived, until a
  // change of its done state has settled (see settleMs).
  const [placed, setPlaced] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(todos.map((todo) => [todo.id, todo.done])),
  );
  const isPlacedDone = (todo: Todo) => placed.get(todo.id) ?? todo.done;
  useEffect(() => {
    const arrived = shown.filter((todo) => !placed.has(todo.id));
    if (arrived.length > 0) {
      setPlaced(
        (prev) =>
          new Map([...prev, ...arrived.map((t) => [t.id, t.done] as const)]),
      );
    }
    const moving = shown.filter(
      (todo) => placed.has(todo.id) && placed.get(todo.id) !== todo.done,
    );
    if (moving.length === 0) return;
    const timer = setTimeout(() => {
      for (const todo of moving) handOffFocus(rowElement(listRef, todo.id));
      setPlaced(
        (prev) =>
          new Map([...prev, ...moving.map((t) => [t.id, t.done] as const)]),
      );
    }, settleMs);
    return () => clearTimeout(timer);
  }, [shown, placed]);

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
    if (!title) {
      setError("A todo needs a title.");
      return;
    }
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
      onDone={(done) =>
        change({ type: "done", id: todo.id, done }, () =>
          setTodoDoneAction(todo.id, done),
        )
      }
      onDelete={() => {
        handOffFocus(rowElement(listRef, todo.id));
        change({ type: "delete", id: todo.id }, () =>
          deleteTodoAction(todo.id),
        );
      }}
    />
  );

  const ordered = [...shown].sort(compareInSection);
  const open = ordered.filter((todo) => !isPlacedDone(todo));
  const done = ordered.filter(isPlacedDone);

  return (
    <div ref={listRef} className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
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
          <div className="min-w-0 flex-[1_1_9rem] sm:flex-none">
            <Field label="Due (optional)" name="dueDate" type="date" />
          </div>
          <SubmitButton>Add</SubmitButton>
        </form>
        <FormError message={error} />
      </div>
      <Section
        title="Open"
        todos={open}
        empty={
          shown.length === 0
            ? "An empty list. Lissie finds that suspicious. Add a todo above, or tell her what's on your mind."
            : "Nothing open. Lissie will pretend this happens all the time."
        }
      >
        {row}
      </Section>
      {shown.length > 0 && (
        <Section
          title="Done"
          todos={done}
          empty="Nothing done yet. Lissie has noticed."
        >
          {row}
        </Section>
      )}
    </div>
  );
}
