import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/page-title";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account · todo-cat" };

export default function SignUpPage() {
  return (
    <>
      <PageTitle lead="Create an account and she'll keep yours. You still do the tasks.">
        Lissie keeps the list.
      </PageTitle>
      <SignUpForm />
    </>
  );
}
