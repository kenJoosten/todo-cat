import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { PageTitle } from "@/components/ui/page-title";
import { ApiTester } from "./api-tester";

export const metadata: Metadata = { title: "API tester · todo-cat" };

// A developer tool, so production answers 404; `next dev` and the e2e server serve it.
export default function ApiTesterPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PageShell wide>
      <PageTitle lead="Sign in for a bearer token, pick an endpoint, and send it. Every answer is checked against the contract the CLI will rely on.">
        Poke the API.
      </PageTitle>
      <ApiTester />
    </PageShell>
  );
}
