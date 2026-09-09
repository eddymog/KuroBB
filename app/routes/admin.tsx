import { Link } from "react-router";

import { PageHeading } from "~/components/ui/PageHeading";
import { requireAdmin } from "~server/features/auth/service";

import type { Route } from "./+types/admin";

export function meta() {
  return [{ title: "Admin · KuroBB" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

export default function AdminDashboard() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>Admin</PageHeading>
      <ul className="flex flex-col gap-2">
        <li>
          <Link to="/admin/forums" className="text-accent hover:underline">
            Forum structure
          </Link>
        </li>
        <li>
          <Link to="/admin/groups" className="text-accent hover:underline">
            Groups &amp; permissions
          </Link>
        </li>
      </ul>
      <p className="text-sm text-ink-muted italic">
        Migration-run history isn't shown here — no migration script exists yet
        (Phase 4 is set aside). Moderation tools (report queue, ban/lock actions) — Phase
        5, not built yet either.
      </p>
    </main>
  );
}
