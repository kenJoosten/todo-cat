import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/page-title";
import { returnPath } from "../../return-path";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account · todo-cat" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  // Set by pages that need a signed-in user, such as /device, to come back to them.
  const next = returnPath((await searchParams).next);
  return (
    <>
      <PageTitle lead="Create an account and she'll keep yours. You still do the tasks.">
        Lissie keeps the list.
      </PageTitle>
      <SignUpForm next={next} />
    </>
  );
}
