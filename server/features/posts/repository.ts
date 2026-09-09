import { asc, eq, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "~server/db/client";
import { posts, threads, users } from "~server/db/schema";

type Executor = typeof db | PgTransaction<any, any, any>;

export async function insertPost(
  input: {
    threadId: number;
    userId: number | null;
    bodyBbcode: string;
    bodyHtmlCache: string;
  },
  exec: Executor = db,
) {
  const [row] = await exec
    .insert(posts)
    .values({
      threadId: input.threadId,
      userId: input.userId,
      bodyBbcode: input.bodyBbcode,
      bodyHtmlCache: input.bodyHtmlCache,
    })
    .returning();
  return row;
}

export async function findPostById(id: number) {
  const [row] = await db.select().from(posts).where(eq(posts.id, id));
  return row;
}

// §08: body_bbcode is the source of truth, never mutated destructively —
// this only ever regenerates body_html_cache alongside a real edit to the
// source. Re-rendering everything from body_bbcode after a parser fix is a
// separate, later concern (a backfill script), not this function's job.
export async function updatePostBody(
  id: number,
  input: { bodyBbcode: string; bodyHtmlCache: string },
) {
  const [row] = await db
    .update(posts)
    .set({ ...input, editedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();
  return row;
}

// Atomic UPDATE increment, same transaction as the post insert — decided in
// kurobb-design.md §05, fixing the exact read-modify-write race MyBB's own
// update_thread_counters() has.
export async function bumpThreadOnNewPost(
  threadId: number,
  postId: number,
  exec: Executor = db,
) {
  await exec
    .update(threads)
    .set({
      replyCount: sql`${threads.replyCount} + 1`,
      lastPostId: postId,
    })
    .where(eq(threads.id, threadId));
}

// For a thread's first post (the OP) only — sets last_post_id without
// touching reply_count, since the OP isn't a reply. Actual replies go
// through bumpThreadOnNewPost above instead.
export async function setThreadFirstPost(
  threadId: number,
  postId: number,
  exec: Executor = db,
) {
  await exec.update(threads).set({ lastPostId: postId }).where(eq(threads.id, threadId));
}

// Left join, not inner — userId is nullable (a guest post, §07), and a post
// shouldn't vanish from a thread just because it has no author to join to.
// This is the join PostCard's authorLabel prop needed (app/components/ui/
// PostCard.tsx) that nothing selected before this.
export async function listPostsForThread(
  threadId: number,
  { page, perPage }: { page: number; perPage: number },
) {
  return db
    .select({ post: posts, authorUsername: users.username })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.threadId, threadId))
    .orderBy(asc(posts.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
}
