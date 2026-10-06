import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Form } from "@/components/ui/form";
import { PageShell } from "@/components/ui/page-shell";
import { PageTitle } from "@/components/ui/page-title";
import { SubmitButton } from "@/components/ui/submit-button";
import { getUserId } from "@/lib/auth";
import { user } from "@/lib/auth-schema";
import { db } from "@/lib/db";
import { lissieThreadId } from "@/lib/lissie/thread";
import { listTodos } from "@/lib/todo-service";
import { signOut } from "./auth-actions";
import { LissieChat } from "./lissie-chat";
import { TodoSidebar } from "./todo-sidebar";

export default async function Home() {
  const userId = await getUserId(await headers());
  if (!userId) redirect("/login");
  const [me] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  if (!me) redirect("/login");
  const todos = await listTodos(userId, { status: "all" });

  return (
    <PageShell wide>
      <PageTitle lead="Lissie keeps your list. She'll talk about it, and nothing else.">
        Hi, {me.name}.
      </PageTitle>
      <Form action={signOut}>
        <div>
          <SubmitButton variant="secondary">Sign out</SubmitButton>
        </div>
      </Form>
      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <LissieChat threadId={lissieThreadId(userId)} />
        <TodoSidebar todos={todos} />
      </div>
    </PageShell>
  );
}
