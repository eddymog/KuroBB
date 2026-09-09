import { Form, Link, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { login } from "~server/features/auth/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/auth.login";

export function meta() {
  return [{ title: "Log in · KuroBB" }];
}

const schema = z.object({
  usernameOrEmail: z.string().min(1, "Enter your username or email."),
  password: z.string().min(1, "Enter your password."),
});

export async function action({ request }: Route.ActionArgs) {
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  // An incorrect username/password is a service-layer UNAUTHENTICATED throw
  // (§07), not a Zod-schema failure — same "still throws" boundary as every
  // other service-level check in this pass.
  const { setCookieHeader } = await login(result.data);
  return redirect("/forums", { headers: { "Set-Cookie": setCookieHeader } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-8 p-6">
      <PageHeading>Log in</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field
          name="usernameOrEmail"
          label="Username or email"
          required
          error={actionData?.fieldErrors?.usernameOrEmail}
        />
        <Field
          name="password"
          type="password"
          label="Password"
          required
          error={actionData?.fieldErrors?.password}
        />
        <Button type="submit">Log in</Button>
      </Form>
      <Link to="/auth/register" className="text-sm text-accent">
        Need an account?
      </Link>
    </main>
  );
}
