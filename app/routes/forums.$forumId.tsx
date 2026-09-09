import { Link } from "react-router";

import { Pagination } from "~/components/ui/Pagination";
import { PageHeading } from "~/components/ui/PageHeading";
import { getCurrentUser } from "~server/features/auth/service";
import { listForumThreads } from "~server/features/forums/service";
import { requirePermission } from "~server/features/permissions/service";

import type { Route } from "./+types/forums.$forumId";

const PER_PAGE = 20;

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.forum.name} · KuroBB` : "Forum · KuroBB" }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const forumId = Number(params.forumId);
  const user = await getCurrentUser(request);
  await requirePermission(user, forumId, "view");
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  return listForumThreads(forumId, { page, perPage: PER_PAGE });
}

export default function ForumThreads({ loaderData }: Route.ComponentProps) {
  const { forum, threads, page, totalPages } = loaderData;
  const isEmpty = threads.length === 0;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 md:p-8">
      <div>
        <div className="flex items-baseline justify-between">
          <PageHeading>{forum.name}</PageHeading>
          {!isEmpty && (
            <Link to={`/forums/${forum.id}/new`} className="text-sm text-accent">
              New thread
            </Link>
          )}
        </div>
        {forum.description && <p className="mt-1 text-sm text-ink-muted">{forum.description}</p>}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-ink-muted">No threads yet.</p>
          <Link to={`/forums/${forum.id}/new`} className="text-accent">
            Start the first thread
          </Link>
        </div>
      ) : (
        <ul>
          {threads.map((thread) => (
            <li key={thread.id} className="border-b border-border py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-4">
                <Link to={`/threads/${thread.id}`} className="font-serif text-lg text-ink">
                  {thread.title}
                </Link>
                <span className="shrink-0 text-sm text-ink-muted">
                  {thread.replyCount} repl{thread.replyCount === 1 ? "y" : "ies"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </main>
  );
}
