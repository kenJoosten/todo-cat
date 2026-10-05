"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { returnPath } from "./return-path";

// What a failed sign-up or sign-in hands back to its form, so typed values survive the reset.
export type AuthFormState = { error?: string; name?: string; email?: string };

const messages: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_EMAIL_OR_PASSWORD:
    "That email and password don't match. Check both and try again.",
  PASSWORD_TOO_SHORT: "Use at least 8 characters for your password.",
  PASSWORD_TOO_LONG: "Use at most 128 characters for your password.",
  USER_ALREADY_EXISTS:
    "An account with this email already exists. Sign in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists. Sign in instead.",
};

// Turns a Better Auth rejection into a message for the form; anything else is a real error.
function formError(error: unknown) {
  if (!isAPIError(error)) throw error;
  return (
    messages[error.body?.code ?? ""] ??
    error.body?.message ??
    "That didn't work. Try again."
  );
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signUp(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = text(formData, "name").trim();
  const email = text(formData, "email").trim();
  try {
    // Signs the new user in too; nextCookies sets the session cookie.
    await auth.api.signUpEmail({
      body: { name, email, password: text(formData, "password") },
      headers: await headers(),
    });
  } catch (error) {
    return { error: formError(error), name, email };
  }
  redirect(returnPath(text(formData, "next")) ?? "/");
}

export async function signIn(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email").trim();
  try {
    await auth.api.signInEmail({
      body: { email, password: text(formData, "password") },
      headers: await headers(),
    });
  } catch (error) {
    return { error: formError(error), email };
  }
  redirect(returnPath(text(formData, "next")) ?? "/");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
