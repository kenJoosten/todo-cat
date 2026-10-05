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
import { signOut } from "./auth-actions";

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
      <PageTitle lead="Your list isn't here yet. Lissie is working on it, at her own pace.">
        Hi, {me.name}.
      </PageTitle>
      <Form action={signOut}>
        <div>
          <SubmitButton variant="secondary">Sign out</SubmitButton>
        </div>
      </Form>
    </PageShell>
  );
}
