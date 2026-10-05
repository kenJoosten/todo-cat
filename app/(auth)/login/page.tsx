import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/page-title";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · todo-cat" };

export default function SignInPage() {
  return (
    <>
      <PageTitle lead="Sign in and Lissie will pretend she didn't notice you were gone.">
        Back again.
      </PageTitle>
      <SignInForm />
    </>
  );
}
