import { Form, Link, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { requireUser } from "~server/features/auth/service";
import { editPost, getPostOrThrow } from "~server/features/posts/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/posts.$postId.edit";

export function meta() {
  return [{ title: "Editar mensaje · KuroBB" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const post = await getPostOrThrow(Number(params.postId));
  if (post.userId !== user.id && !user.isAdmin) {
    // Same rule editPost enforces on submit — checked here too so the form
    // itself isn't shown to someone who can't use it.
    throw new Response("Prohibido", { status: 403 });
  }
  return { post };
}

const schema = z.object({
  bodyBbcode: z.string().min(1, "El mensaje no puede estar vacío."),
});

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const postId = Number(params.postId);
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  const post = await editPost({
    postId,
    userId: user.id,
    isAdmin: user.isAdmin,
    bodyBbcode: result.data.bodyBbcode,
  });
  return redirect(`/threads/${post.threadId}`);
}

export default function EditPost({ loaderData, actionData }: Route.ComponentProps) {
  const { post } = loaderData;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>Editar mensaje</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field
          as="textarea"
          name="bodyBbcode"
          label="Mensaje"
          defaultValue={post.bodyBbcode}
          required
          error={actionData?.fieldErrors?.bodyBbcode}
        />
        <div>
          <Button type="submit">Guardar</Button>
        </div>
      </Form>
      <Link to={`/threads/${post.threadId}`} className="text-sm text-accent">
        Volver al tema
      </Link>
    </main>
  );
}
