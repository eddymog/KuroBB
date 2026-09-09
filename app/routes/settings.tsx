import { Form, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { requireUser } from "~server/features/auth/service";
import { updateOwnProfile } from "~server/features/users/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Settings · KuroBB" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  // requireUser's row includes passwordHash (§07 tagged-hash format) — never
  // let the full row reach loaderData/hydration, same fix as root.tsx's loader.
  return { user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl, signature: user.signature } };
}

const schema = z.object({
  avatarUrl: z.string().url("Enter a valid URL.").optional().or(z.literal("")),
  signature: z.string().optional(),
});

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  await updateOwnProfile(user.id, {
    avatarUrl: result.data.avatarUrl?.trim() ? result.data.avatarUrl : null,
    signature: result.data.signature?.trim() ? result.data.signature : null,
  });
  return redirect("/settings");
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>Settings</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field
          name="avatarUrl"
          type="url"
          label="Avatar URL"
          defaultValue={user.avatarUrl ?? ""}
          error={actionData?.fieldErrors?.avatarUrl}
        />
        <Field
          as="textarea"
          name="signature"
          label="Signature"
          defaultValue={user.signature ?? ""}
          error={actionData?.fieldErrors?.signature}
        />
        <Button type="submit" className="self-start">
          Save
        </Button>
      </Form>
    </main>
  );
}
