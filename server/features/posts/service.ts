import { throwAppError } from "~server/lib/errors";
import { db } from "~server/db/client";
import { renderBbcodeToHtml } from "~server/lib/bbcode";

import { getThreadOrThrow } from "../forums/service";
import * as repo from "./repository";

export async function listThreadPosts(
  threadId: number,
  { page, perPage }: { page: number; perPage: number },
) {
  const thread = await getThreadOrThrow(threadId);
  const rows = await repo.listPostsForThread(threadId, { page, perPage });
  const totalPages = Math.max(1, Math.ceil(thread.replyCount / perPage) + 1);
  const posts = rows.map((row) => ({
    ...row.post,
    // Guest posts have no userId to join against (§07) — "Guest" here, not a
    // blank label, same reasoning as PostCard being built to take a resolved
    // string rather than assume every post has an author.
    authorLabel: row.authorUsername ?? "Invitado",
  }));
  return { thread, posts, page, perPage, total: thread.replyCount, totalPages };
}

export async function createReply(input: {
  threadId: number;
  userId: number | null;
  bodyBbcode: string;
}) {
  await getThreadOrThrow(input.threadId);
  if (!input.bodyBbcode.trim()) {
    throwAppError("VALIDATION_ERROR", "La respuesta no puede estar vacía.", [
      { field: "bodyBbcode", issue: "La respuesta no puede estar vacía." },
    ]);
  }

  return db.transaction(async (tx) => {
    const post = await repo.insertPost(
      {
        threadId: input.threadId,
        userId: input.userId,
        bodyBbcode: input.bodyBbcode,
        bodyHtmlCache: renderBbcodeToHtml(input.bodyBbcode),
      },
      tx,
    );
    await repo.bumpThreadOnNewPost(input.threadId, post.id, tx);
    return post;
  });
}

export async function getPostOrThrow(id: number) {
  const post = await repo.findPostById(id);
  if (!post) {
    throwAppError("NOT_FOUND", `El mensaje ${id} no existe.`);
  }
  return post;
}

export async function editPost(input: {
  postId: number;
  userId: number;
  isAdmin: boolean;
  bodyBbcode: string;
}) {
  const post = await getPostOrThrow(input.postId);
  if (post.userId !== input.userId && !input.isAdmin) {
    throwAppError("FORBIDDEN", "Solo puedes editar tus propios mensajes.");
  }
  if (!input.bodyBbcode.trim()) {
    throwAppError("VALIDATION_ERROR", "El mensaje no puede estar vacío.", [
      { field: "bodyBbcode", issue: "El mensaje no puede estar vacío." },
    ]);
  }
  // §08: re-renders body_html_cache from the new source; body_bbcode is
  // overwritten with the edit itself (that IS the intentional edit), never
  // mutated in any other way.
  return repo.updatePostBody(input.postId, {
    bodyBbcode: input.bodyBbcode,
    bodyHtmlCache: renderBbcodeToHtml(input.bodyBbcode),
  });
}
