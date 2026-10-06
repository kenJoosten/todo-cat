import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { PageTitle } from "@/components/ui/page-title";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import { getUserId } from "@/lib/auth";
import { user } from "@/lib/auth-schema";
import { db } from "@/lib/db";
import { currentLissieThreadId } from "@/lib/lissie/conversation";
import { listTodos } from "@/lib/todo-service";
import { signOut } from "./auth-actions";
import { LissieChat } from "./lissie-chat";
import { TodoList } from "./todo-list";

// The list is the page's main column; Lissie sits beside it on wide screens and under it on
// phones. Both change the same todos, and either one's change re-renders this page.
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
    <PageShell
      wide
      actions={
        <form action={signOut}>
          <SubmitButton variant="secondary" size="small">
            Sign out
          </SubmitButton>
        </form>
      }
    >
      <div className="grid items-start gap-x-14 gap-y-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex max-w-2xl flex-col gap-12 lg:max-w-none">
          <PageTitle
            size="compact"
            lead="Here's your list. Lissie is watching it, and she can change it too."
          >
            Back to it, {me.name}.
          </PageTitle>
          <section aria-label="Your list">
            <TodoList todos={todos} />
          </section>
        </div>
        <section
          aria-labelledby="lissie-heading"
          className="lg:sticky lg:top-6"
        >
          <LissieChat
            threadId={await currentLissieThreadId(userId)}
            heading={
              <SectionHeading id="lissie-heading">Lissie</SectionHeading>
            }
          />
        </section>
      </div>
    </PageShell>
  );
}
