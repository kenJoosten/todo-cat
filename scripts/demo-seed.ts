// The demo user and their todos, for `npm run db:seed` (scripts/db-seed.mts).
// Running it again resets the demo todos; timestamps depend only on the day it runs.
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "../lib/db";
import { user } from "../lib/schema";
import { replaceTodos, type SeedTodo } from "../lib/todo-service";

export const demoUser = {
  name: "Demo Cat Person",
  email: "demo@todo-cat.dev",
  password: "cat-person-2026",
};

// Days are counted from today: created and done that many days ago, due in that many days.
// Created and done days are at least 1, so no timestamp lands later today.
const demoTodos: {
  title: string;
  created: number;
  done?: number;
  due?: number;
}[] = [
  { title: "Buy the fancy tuna Lissie approves of", created: 14, done: 13 },
  { title: "Book Lissie's annual vet check-up", created: 13, due: 9 },
  { title: "Replace the scratched sofa cushion", created: 12 },
  { title: "Order a new scratching post", created: 11, done: 8 },
  { title: "Clean the litter box properly", created: 10, done: 9, due: -9 },
  { title: "Renew the pet insurance", created: 9, due: -2 },
  { title: "Call grandma back", created: 8, done: 6 },
  { title: "Fix the leaky kitchen tap", created: 6, due: 3 },
  { title: "Return the library books", created: 5, done: 2, due: -1 },
  { title: "Get a sunny windowsill bed", created: 4 },
  { title: "Plan the weekend hike", created: 3, due: 5 },
  { title: "File the quarterly taxes", created: 2, due: 0 },
  { title: "Water the (cat-safe) plants", created: 1, done: 1 },
];

/** A local calendar date as yyyy-mm-dd; toISOString would shift it to UTC. */
function isoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildDemoTodos(today: Date): SeedTodo[] {
  const day = (offset: number, hour: number) =>
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
      hour,
    );
  return demoTodos.map((todo, i) => ({
    title: todo.title,
    dueDate: todo.due === undefined ? null : isoDate(day(todo.due, 0)),
    createdAt: day(-todo.created, 8 + (i % 4)),
    completedAt: todo.done === undefined ? null : day(-todo.done, 18),
  }));
}

async function demoUserId() {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, demoUser.email));
  if (existing) return existing.id;
  const { user: created } = await auth.api.signUpEmail({ body: demoUser });
  return created.id;
}

/** Creates the demo user if needed and replaces their todos with the demo set. */
export async function seedDemo(today = new Date()) {
  const userId = await demoUserId();
  const todos = await replaceTodos(userId, buildDemoTodos(today));
  return { userId, todos };
}
