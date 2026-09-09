import { desc, eq, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "~server/db/client";
import { forums, threads } from "~server/db/schema";

type Executor = typeof db | PgTransaction<any, any, any>;

export async function insertForum(input: {
  name: string;
  description: string | null;
  parentId: number | null;
}) {
  const [row] = await db
    .insert(forums)
    .values({
      name: input.name,
      description: input.description,
      parentId: input.parentId,
    })
    .returning();
  return row;
}

export async function findForumById(id: number) {
  const [row] = await db.select().from(forums).where(eq(forums.id, id));
  return row;
}

export async function listAllForumsFlat() {
  return db.select().from(forums).orderBy(forums.position, forums.id);
}

export async function updateForum(
  id: number,
  input: { name: string; description: string | null; parentId: number | null; position: number },
) {
  const [row] = await db.update(forums).set(input).where(eq(forums.id, id)).returning();
  return row;
}

/** Callers must check threadCount === 0 first — see admin/service.ts. */
export async function deleteForum(id: number) {
  await db.delete(forums).where(eq(forums.id, id));
}

// Atomic UPDATE increment — decided in kurobb-design.md §05. Never
// read-modify-write a counter in application code.
export async function incrementForumThreadCount(forumId: number, exec: Executor = db) {
  await exec
    .update(forums)
    .set({ threadCount: sql`${forums.threadCount} + 1` })
    .where(eq(forums.id, forumId));
}

export async function insertThread(
  input: { forumId: number; userId: number | null; title: string },
  exec: Executor = db,
) {
  const [row] = await exec
    .insert(threads)
    .values({ forumId: input.forumId, userId: input.userId, title: input.title })
    .returning();
  return row;
}

export async function findThreadById(id: number) {
  const [row] = await db.select().from(threads).where(eq(threads.id, id));
  return row;
}

export async function listThreadsForForum(
  forumId: number,
  { page, perPage }: { page: number; perPage: number },
) {
  // Newest-created first for now — bump-to-top-on-reply would need a
  // last_post_at timestamp (we only have last_post_id, a bare FK) and is a
  // reasonable Phase 1 simplification to flag rather than silently assume.
  const rows = await db
    .select()
    .from(threads)
    .where(eq(threads.forumId, forumId))
    .orderBy(desc(threads.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return rows;
}
