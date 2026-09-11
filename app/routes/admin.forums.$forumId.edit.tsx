import { Form, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { requireAdmin } from "~server/features/auth/service";
import { deleteForumIfEmpty, editForum, listForumsForAdmin } from "~server/features/admin/service";
import { throwAppError } from "~server/lib/errors";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/admin.forums.$forumId.edit";

export function meta() {
  return [{ title: "Editar foro · Admin · KuroBB" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const forumId = Number(params.forumId);
  const forums = await listForumsForAdmin();
  const forum = forums.find((f) => f.id === forumId);
  if (!forum) {
    throwAppError("NOT_FOUND", `El foro ${forumId} no existe.`);
  }
  // Everything except itself and (to keep this simple) its own subtree —
  // real cycle-prevention beyond "not itself" isn't worth the extra query
  // at a ~200-forum ceiling; re-parenting into a cycle would just make that
  // branch invisible from the root until fixed, not corrupt any data.
  const otherForums = forums.filter((f) => f.id !== forumId);
  return { forum, otherForums };
}

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  description: z.string().optional(),
  parentId: z.string().optional(),
  position: z.coerce.number().int().default(0),
});

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const forumId = Number(params.forumId);
  const formData = await request.formData();

  if (formData.get("_action") === "delete") {
    await deleteForumIfEmpty(forumId);
    return redirect("/admin/forums");
  }

  const result = await safeParseFormData(formData, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  await editForum(forumId, {
    name: result.data.name,
    description: result.data.description?.trim() ? result.data.description : null,
    parentId: result.data.parentId ? Number(result.data.parentId) : null,
    position: result.data.position,
  });
  return redirect("/admin/forums");
}

export default function EditForum({ loaderData, actionData }: Route.ComponentProps) {
  const { forum, otherForums } = loaderData;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>Editar foro</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field
          name="name"
          label="Nombre"
          required
          defaultValue={forum.name}
          error={actionData && "fieldErrors" in actionData ? actionData.fieldErrors.name : undefined}
        />
        <Field
          as="textarea"
          name="description"
          label="Descripción"
          defaultValue={forum.description ?? ""}
        />
        <Field
          as="select"
          name="parentId"
          label="Foro padre"
          defaultValue={forum.parentId ?? ""}
        >
          <option value="">— ninguno (nivel superior) —</option>
          {otherForums.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Field>
        <Field name="position" type="number" label="Posición" defaultValue={forum.position} />
        <Button type="submit" className="self-start">
          Guardar
        </Button>
      </Form>
      <Form method="post">
        <input type="hidden" name="_action" value="delete" />
        <Button type="submit" variant="destructive" disabled={forum.threadCount > 0}>
          Eliminar foro{forum.threadCount > 0 ? ` (tiene ${forum.threadCount} temas)` : ""}
        </Button>
      </Form>
    </main>
  );
}
