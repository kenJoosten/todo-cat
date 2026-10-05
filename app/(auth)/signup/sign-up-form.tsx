"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Form, FormNote } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextLink } from "@/components/ui/text-link";
import { signUp } from "../../auth-actions";

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, {});
  return (
    <>
      <Form action={action}>
        <Field
          label="Name"
          name="name"
          autoComplete="name"
          defaultValue={state.name}
          required
        />
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
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        {next && <input type="hidden" name="next" value={next} />}
        <FormError message={state.error} />
        <SubmitButton>Create account</SubmitButton>
      </Form>
      <FormNote>
        Already have an account?{" "}
        <TextLink
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
        >
          Sign in
        </TextLink>
      </FormNote>
    </>
  );
}
