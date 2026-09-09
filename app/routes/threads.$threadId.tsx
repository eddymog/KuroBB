import { Form } from "react-router";
import { z } from "zod";

import { Field } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";
import { PageHeading } from "~/components/ui/PageHeading";
import { Pagination } from "~/components/ui/Pagination";
import { PostCard } from "~/components/ui/PostCard";
import { getCurrentUser } from "~server/features/auth/service";
import { getThreadOrThrow } from "~server/features/forums/service";
import { listThreadPosts, createReply } from "~server/features/posts/service";
import { requirePermission } from "~server/features/permissions/service";
import { parseFormData } from "~server/lib/validation";

import type { Route } from "./+types/threads.$threadId";

const PER_PAGE = 20;

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `${loaderData.thread.title} · KuroBB` : "Thread · KuroBB" },
    {
      name: "description",
      content: loaderData
        ? `${loaderData.thread.title} — ${loaderData.total} replies on KuroBB.`
        : undefined,
    },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const threadId = Number(params.threadId);
  const thread = await getThreadOrThrow(threadId);
  const user = await getCurrentUser(request);
  await requirePermission(user, thread.forumId, "view");
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const data = await listThreadPosts(threadId, { page, perPage: PER_PAGE });
  const posts = data.posts.map((post) => ({
    ...post,
    canEdit: user != null && (user.id === post.userId || user.isAdmin),
  }));
  return { ...data, posts };
}

const replySchema = z.object({
  bodyBbcode: z.string().min(1, "Reply cannot be empty."),
});

export async function action({ request, params }: Route.ActionArgs) {
  const threadId = Number(params.threadId);
  const thread = await getThreadOrThrow(threadId);
  const user = await getCurrentUser(request);
  await requirePermission(user, thread.forumId, "post");
  const input = await parseFormData(request, replySchema);
  await createReply({ threadId, userId: user?.id ?? null, bodyBbcode: input.bodyBbcode });
  return null;
}

export default function Thread({ loaderData }: Route.ComponentProps) {
  const { thread, posts, page, totalPages } = loaderData;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>{thread.title}</PageHeading>

      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            postId={post.id}
            authorLabel={post.authorLabel}
            createdAt={post.createdAt}
            bodyHtml={post.bodyHtmlCache}
            canEdit={post.canEdit}
          />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} />

      <div>
        <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Reply</h2>
        <Form method="post" className="flex flex-col gap-4">
          <Field as="textarea" name="bodyBbcode" label="Your reply" required />
          <div>
            <Button type="submit">Post reply</Button>
          </div>
        </Form>
      </div>
    </main>
  );
}
