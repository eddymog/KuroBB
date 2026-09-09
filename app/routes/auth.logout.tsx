import { Form, redirect } from "react-router";

import { Button } from "~/components/ui/Button";
import { PageHeading } from "~/components/ui/PageHeading";
import { logout } from "~server/features/auth/service";

import type { Route } from "./+types/auth.logout";

export async function action({ request }: Route.ActionArgs) {
  const { setCookieHeader } = await logout(request);
  return redirect("/", { headers: { "Set-Cookie": setCookieHeader } });
}

// GET here just shows a confirmation button — logout is a mutation
// (revokes the session), so it has to be a POST, not a plain link.
export default function Logout() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-6 p-6">
      <PageHeading>Log out</PageHeading>
      <Form method="post">
        <Button type="submit">Confirm log out</Button>
      </Form>
    </main>
  );
}
