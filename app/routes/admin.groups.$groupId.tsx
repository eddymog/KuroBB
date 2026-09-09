import { Form, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { PageHeading } from "~/components/ui/PageHeading";
import { Table, Td, Th } from "~/components/ui/Table";
import { requireAdmin } from "~server/features/auth/service";
import {
  addMemberToGroupByUsername,
  getGroupDetailOrThrow,
  removeMemberFromGroup,
  setForumPermission,
} from "~server/features/admin/service";
import { parseFormData } from "~server/lib/validation";

import type { Route } from "./+types/admin.groups.$groupId";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `${loaderData.group.name} · Admin · KuroBB` : "Group · Admin · KuroBB" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  return getGroupDetailOrThrow(Number(params.groupId));
}

const addMemberSchema = z.object({ username: z.string().min(1) });
const permissionSchema = z.object({
  forumId: z.coerce.number(),
  canView: z.enum(["inherit", "allow", "deny"]),
  canPost: z.enum(["inherit", "allow", "deny"]),
});

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const groupId = Number(params.groupId);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  if (actionType === "add-member") {
    const input = await parseFormData(formData, addMemberSchema);
    await addMemberToGroupByUsername(groupId, input.username);
  } else if (actionType === "remove-member") {
    await removeMemberFromGroup(groupId, Number(formData.get("userId")));
  } else if (actionType === "set-permission") {
    const input = await parseFormData(formData, permissionSchema);
    await setForumPermission({ groupId, ...input });
  }

  return redirect(`/admin/groups/${groupId}`);
}

export default function GroupDetail({ loaderData }: Route.ComponentProps) {
  const { group, members, forumRules } = loaderData;

  function triState(value: boolean | null): "inherit" | "allow" | "deny" {
    if (value === true) return "allow";
    if (value === false) return "deny";
    return "inherit";
  }

  const selectClasses = "border border-border bg-surface px-2 py-1 text-sm text-ink";

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 p-6 md:p-8">
      <PageHeading>{group.name}</PageHeading>

      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold text-ink">Members</h2>
        {members.length === 0 ? (
          <p className="text-ink-muted">No members yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Username</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <Td>{member.username}</Td>
                  <Td>
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="remove-member" />
                      <input type="hidden" name="userId" value={member.id} />
                      <Button type="submit" variant="destructive">
                        Remove
                      </Button>
                    </Form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Form method="post" className="flex items-end gap-2">
          <input type="hidden" name="_action" value="add-member" />
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-sm text-ink-muted">
              Username
            </label>
            <input
              id="username"
              type="text"
              name="username"
              placeholder="username"
              required
              className="border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <Button type="submit">Add member</Button>
        </Form>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold text-ink">Forum permissions</h2>
        <p className="text-sm text-ink-muted italic">
          "Inherit" means no rule at this level — falls through to the forum's parent
          chain, or allow by default if nothing anywhere says otherwise (§05).
        </p>
        {/* One <form> per row, declared outside the table and associated with
            that row's controls via the HTML5 `form` attribute — a <form>
            can't legally be a direct child of <tr> (only <td>/<th> can), so
            nesting one there would just get silently corrected/broken by the
            browser's HTML parser rather than actually submit per row. */}
        {forumRules.map((rule) => (
          <form key={rule.forumId} id={`perm-form-${rule.forumId}`} method="post" hidden>
            <input type="hidden" name="_action" value="set-permission" />
            <input type="hidden" name="forumId" value={rule.forumId} />
          </form>
        ))}
        <Table>
          <thead>
            <tr>
              <Th>Forum</Th>
              <Th>View</Th>
              <Th>Post</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {forumRules.map((rule) => {
              const formId = `perm-form-${rule.forumId}`;
              return (
                <tr key={rule.forumId}>
                  <Td>{rule.forumName}</Td>
                  <Td>
                    <select
                      name="canView"
                      form={formId}
                      defaultValue={triState(rule.canView)}
                      className={selectClasses}
                    >
                      <option value="inherit">Inherit</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </Td>
                  <Td>
                    <select
                      name="canPost"
                      form={formId}
                      defaultValue={triState(rule.canPost)}
                      className={selectClasses}
                    >
                      <option value="inherit">Inherit</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </Td>
                  <Td>
                    <Button type="submit" form={formId} variant="secondary">
                      Save
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </main>
  );
}
