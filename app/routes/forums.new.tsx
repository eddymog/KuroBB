import { Form, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { requireAdmin } from "~server/features/auth/service";
import { createForum } from "~server/features/forums/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/forums.new";

export function meta() {
  return [{ title: "Crear un foro · KuroBB" }];
}

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

// Gated now that auth exists — closes the gap Phase 1 knowingly left open.
// requireAdmin throws FORBIDDEN/UNAUTHENTICATED (§06), rendered via the
// root ErrorBoundary, on both the loader (don't even show the form) and the
// action (don't trust the client not to have bypassed the UI).
export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  const forum = await createForum({
    name: result.data.name,
    description: result.data.description?.trim() ? result.data.description : null,
    parentId: result.data.parentId ? Number(result.data.parentId) : null,
  });
  return redirect(`/forums/${forum.id}`);
}

export default function NewForum({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>Crear un foro</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field name="name" label="Nombre" required error={actionData?.fieldErrors?.name} />
        <Field
          as="textarea"
          name="description"
          label="Descripción"
          error={actionData?.fieldErrors?.description}
        />
        <div>
          <Button type="submit">Crear foro</Button>
        </div>
      </Form>
    </main>
  );
}
