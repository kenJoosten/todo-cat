import { cliClientId, formatUserCode } from "@todo-cat/contract";
import { isAPIError } from "better-auth/api";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ButtonRow } from "@/components/ui/button-row";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { PageShell } from "@/components/ui/page-shell";
import { PageTitle } from "@/components/ui/page-title";
import { SubmitButton } from "@/components/ui/submit-button";
import { UserCode } from "@/components/ui/user-code";
import { auth, getUserId } from "@/lib/auth";
import { approveDevice, denyDevice } from "./actions";

// Where a signed-in user approves a device login, such as `todo-cat login`.
// Per Better Auth's device authorization guide, the page has the user enter or confirm the
// code, names the client, needs an explicit approve or deny, and warns about phishing.

export const metadata: Metadata = { title: "Log in a device · todo-cat" };

const clientNames: Record<string, string> = {
  [cliClientId]: "The todo-cat CLI",
};

type Review = { ok: true; client: string } | { ok: false; message: string };

// Looking the code up as a signed-in user also claims it for that user, so only they can
// approve or deny it afterwards.
async function review(code: string, requestHeaders: Headers): Promise<Review> {
  try {
    const result = await auth.api.deviceVerify({
      query: { user_code: code },
      headers: requestHeaders,
    });
    if (result.status !== "pending") {
      return {
        ok: false,
        message:
          "That code has been used already. Run todo-cat login again for a new one.",
      };
    }
    // Better Auth names the client only to the user who claimed the code.
    if (!result.client_id) {
      return {
        ok: false,
        message: "That code belongs to someone else's login.",
      };
    }
    return {
      ok: true,
      client: clientNames[result.client_id] ?? result.client_id,
    };
  } catch (error) {
    if (!isAPIError(error)) throw error;
    return {
      ok: false,
      message:
        error.body?.error === "expired_token"
          ? "That code has expired. Run todo-cat login again for a new one."
          : "That code doesn't exist. Check it against your terminal and try again.",
    };
  }
}

function CodeForm({ code, error }: { code?: string; error?: string }) {
  return (
    <Form action="/device">
      <Field
        label="Code"
        name="user_code"
        mono
        defaultValue={code}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
      />
      <FormError message={error} />
      <SubmitButton>Continue</SubmitButton>
    </Form>
  );
}

export default async function DevicePage({
  searchParams,
}: PageProps<"/device">) {
  const query = await searchParams;
  const code =
    typeof query.user_code === "string" ? query.user_code.trim() : "";
  const requestHeaders = await headers();
  if (!(await getUserId(requestHeaders))) {
    const here = code
      ? `/device?user_code=${encodeURIComponent(code)}`
      : "/device";
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }

  if (query.result === "approved") {
    return (
      <PageShell>
        <PageTitle lead="It's logged in as you now. Go back to your terminal; you can close this tab.">
          Fine. It's in.
        </PageTitle>
      </PageShell>
    );
  }
  if (query.result === "denied") {
    return (
      <PageShell>
        <PageTitle lead="Nothing was logged in. If you did start this login, run todo-cat login again.">
          Denied. Good instinct.
        </PageTitle>
      </PageShell>
    );
  }

  const intro = (
    <PageTitle lead="Enter the code your terminal shows, and Lissie will check who's asking.">
      Got a code?
    </PageTitle>
  );
  if (!code) {
    return (
      <PageShell>
        {intro}
        <CodeForm />
      </PageShell>
    );
  }

  const result = await review(code, requestHeaders);
  if (!result.ok) {
    return (
      <PageShell>
        {intro}
        <CodeForm code={code} error={result.message} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageTitle
        lead={`${result.client} wants to use your todo-cat account. Check that this code is the one in your terminal.`}
      >
        Is this you?
      </PageTitle>
      <UserCode code={formatUserCode(code)} />
      <Callout>
        <strong>Only approve a login you just started yourself</strong>, on a
        computer you control, with the same code. It can then read, add, change
        and delete your todos as you, until it logs out. If someone sent you
        this code or link, deny it.
      </Callout>
      <ButtonRow>
        <form action={approveDevice}>
          <input type="hidden" name="user_code" value={code} />
          <SubmitButton>Approve</SubmitButton>
        </form>
        <form action={denyDevice}>
          <input type="hidden" name="user_code" value={code} />
          <SubmitButton variant="secondary">Deny</SubmitButton>
        </form>
      </ButtonRow>
    </PageShell>
  );
}
