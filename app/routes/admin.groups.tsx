import { Form, Link, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { Table, Td, Th } from "~/components/ui/Table";
import { requireAdmin } from "~server/features/auth/service";
import { createGroup, listGroups } from "~server/features/admin/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/admin.groups";

export function meta() {
  return [{ title: "Groups & permissions · Admin · KuroBB" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const groups = await listGroups();
  return { groups };
}

const schema = z.object({ name: z.string().min(1, "Group name is required.") });

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  await createGroup(result.data.name);
  return redirect("/admin/groups");
}

export default function AdminGroups({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>Groups &amp; permissions</PageHeading>
      {loaderData.groups.length === 0 ? (
        <p className="text-ink-muted">No groups yet — create one below.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loaderData.groups.map((group) => (
              <tr key={group.id}>
                <Td>{group.name}</Td>
                <Td>
                  <Link to={`/admin/groups/${group.id}`} className="text-accent hover:underline">
                    Manage
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold text-ink">New group</h2>
        <Form method="post" className="flex flex-col gap-4">
          <Field
            name="name"
            label="Name"
            placeholder="e.g. Moderator"
            required
            error={actionData?.fieldErrors?.name}
          />
          <Button type="submit" className="self-start">
            Create
          </Button>
        </Form>
      </div>
    </main>
  );
}
