import { Form, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { register } from "~server/features/auth/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/auth.register";

export function meta() {
  return [{ title: "Register · KuroBB" }];
}

const schema = z.object({
  username: z.string().min(1, "Username is required."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function action({ request }: Route.ActionArgs) {
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  // A duplicate username/email is still a service-layer CONFLICT throw, not
  // a Zod-schema failure — consistent with forums.new/etc., only the fields
  // Zod itself can validate get inline display in this pass.
  await register(result.data);
  return redirect("/auth/login");
}

export default function Register({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-8 p-6">
      <PageHeading>Register</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field
          name="username"
          label="Username"
          required
          error={actionData?.fieldErrors?.username}
        />
        <Field
          name="email"
          type="email"
          label="Email"
          required
          error={actionData?.fieldErrors?.email}
        />
        <Field
          name="password"
          type="password"
          label="Password"
          required
          minLength={8}
          error={actionData?.fieldErrors?.password}
        />
        <Button type="submit">Register</Button>
      </Form>
    </main>
  );
}
