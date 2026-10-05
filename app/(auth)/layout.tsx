import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { getUserId } from "@/lib/auth";

// /login and /signup are for signed-out visitors; signed-in users go straight to their list.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getUserId(await headers())) redirect("/");
  return <PageShell>{children}</PageShell>;
}
