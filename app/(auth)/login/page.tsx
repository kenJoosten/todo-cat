import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/page-title";
import { returnPath } from "../../return-path";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · todo-cat" };

export default async function SignInPage({
  searchParams,
}: PageProps<"/login">) {
  // Set by pages that need a signed-in user, such as /device, to come back to them.
  const next = returnPath((await searchParams).next);
  return (
    <>
      <PageTitle lead="Sign in and Lissie will pretend she didn't notice you were gone.">
        Back again.
      </PageTitle>
      <SignInForm next={next} />
    </>
  );
}
