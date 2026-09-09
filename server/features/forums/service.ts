import { throwAppError } from "~server/lib/errors";
import { db } from "~server/db/client";
import { renderBbcodeToHtml } from "~server/lib/bbcode";

import * as postsRepo from "../posts/repository";
import * as repo from "./repository";
import { getForumNode, invalidateForumTree } from "./tree";

export { getForumTree } from "./tree";

export async function createForum(input: {
  name: string;
  description: string | null;
  parentId: number | null;
}) {
  const forum = await repo.insertForum(input);
  invalidateForumTree();
  return forum;
}

export async function getForumOrThrow(id: number) {
  const node = await getForumNode(id);
  if (!node) {
    throwAppError("NOT_FOUND", `Forum ${id} does not exist.`);
  }
  return node;
}

export async function getThreadOrThrow(id: number) {
  const thread = await repo.findThreadById(id);
  if (!thread) {
    throwAppError("NOT_FOUND", `Thread ${id} does not exist.`);
  }
  return thread;
}

// Thread creation is really "insert a thread row + its first post" — the OP
// is a real post like any other (posts.threadId), not a separate concept.
// One transaction: insert thread, insert first post, point the thread at it
// (no reply_count increment — the OP isn't a reply), bump the forum's
// thread_count atomically (§05).
export async function createThread(input: {
  forumId: number;
  userId: number | null;
  title: string;
  bodyBbcode: string;
}) {
  await getForumOrThrow(input.forumId);
  if (!input.title.trim()) {
    throwAppError("VALIDATION_ERROR", "Title cannot be empty.", [
      { field: "title", issue: "Title cannot be empty." },
    ]);
  }
  if (!input.bodyBbcode.trim()) {
    throwAppError("VALIDATION_ERROR", "Post body cannot be empty.", [
      { field: "bodyBbcode", issue: "Post body cannot be empty." },
    ]);
  }

  const thread = await db.transaction(async (tx) => {
    const newThread = await repo.insertThread(
      { forumId: input.forumId, userId: input.userId, title: input.title },
      tx,
    );
    const post = await postsRepo.insertPost(
      {
        threadId: newThread.id,
        userId: input.userId,
        bodyBbcode: input.bodyBbcode,
        bodyHtmlCache: renderBbcodeToHtml(input.bodyBbcode),
      },
      tx,
    );
    await postsRepo.setThreadFirstPost(newThread.id, post.id, tx);
    await repo.incrementForumThreadCount(input.forumId, tx);
    return newThread;
  });

  invalidateForumTree();
  return thread;
}

export async function listForumThreads(
  forumId: number,
  { page, perPage }: { page: number; perPage: number },
) {
  const forum = await getForumOrThrow(forumId);
  const rows = await repo.listThreadsForForum(forumId, { page, perPage });
  const totalPages = Math.max(1, Math.ceil(forum.threadCount / perPage));
  return {
    forum,
    threads: rows,
    page,
    perPage,
    total: forum.threadCount,
    totalPages,
  };
}
