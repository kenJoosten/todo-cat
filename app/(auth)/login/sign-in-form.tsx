"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Form, FormNote } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextLink } from "@/components/ui/text-link";
import { signIn } from "../../auth-actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, {});
  return (
    <>
      <Form action={action}>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {next && <input type="hidden" name="next" value={next} />}
        <FormError message={state.error} />
        <SubmitButton>Sign in</SubmitButton>
      </Form>
      <FormNote>
        New here?{" "}
        <TextLink
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
        >
          Create an account
        </TextLink>
      </FormNote>
    </>
  );
}
