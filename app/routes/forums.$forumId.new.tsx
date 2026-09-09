import { Form, Link, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { getCurrentUser } from "~server/features/auth/service";
import { createThread } from "~server/features/forums/service";
import { requirePermission } from "~server/features/permissions/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/forums.$forumId.new";

export function meta() {
  return [{ title: "New thread · KuroBB" }];
}

const schema = z.object({
  title: z.string().min(1, "Title is required."),
  bodyBbcode: z.string().min(1, "Post cannot be empty."),
});

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  await requirePermission(user, Number(params.forumId), "post");
  return null;
}

export async function action({ request, params }: Route.ActionArgs) {
  const forumId = Number(params.forumId);
  const user = await getCurrentUser(request);
  await requirePermission(user, forumId, "post");
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  const thread = await createThread({
    forumId,
    userId: user?.id ?? null, // guests can post if the Guest group isn't denied here
    title: result.data.title,
    bodyBbcode: result.data.bodyBbcode,
  });
  return redirect(`/threads/${thread.id}`);
}

export default function NewThread({ params, actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>New thread</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field name="title" label="Title" required error={actionData?.fieldErrors?.title} />
        <Field
          as="textarea"
          name="bodyBbcode"
          label="Post"
          required
          error={actionData?.fieldErrors?.bodyBbcode}
        />
        <div>
          <Button type="submit">Create thread</Button>
        </div>
      </Form>
      <Link to={`/forums/${params.forumId}`} className="text-sm text-accent">
        Back to forum
      </Link>
    </main>
  );
}
