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
import { signOut } from "./auth-actions";
import { LissieChat } from "./lissie-chat";

export default async function Home() {
  const userId = await getUserId(await headers());
  if (!userId) redirect("/login");
  const [me] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  if (!me) redirect("/login");

  return (
    <PageShell>
      <PageTitle lead="Lissie keeps your list. She'll talk about it, and nothing else.">
        Hi, {me.name}.
      </PageTitle>
      <Form action={signOut}>
        <div>
          <SubmitButton variant="secondary">Sign out</SubmitButton>
        </div>
      </Form>
      <LissieChat threadId={lissieThreadId(userId)} />
    </PageShell>
  );
}
