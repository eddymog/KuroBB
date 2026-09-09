import { asc } from "drizzle-orm";

import { db } from "~server/db/client";
import { forums } from "~server/db/schema";

export interface ForumNode {
  id: number;
  parentId: number | null;
  name: string;
  description: string | null;
  position: number;
  threadCount: number;
  children: ForumNode[];
}

// The whole forum table, loaded into memory and walked as a tree — decided
// in kurobb-design.md §05 given a hard ceiling of ~200 forums. No closure
// table, no ltree; just a plain Map rebuilt whenever a forum is created or
// moved (see invalidate() below).
let cache: { byId: Map<number, ForumNode>; roots: ForumNode[] } | null = null;

async function load() {
  const rows = await db
    .select()
    .from(forums)
    .orderBy(asc(forums.position), asc(forums.id));

  const byId = new Map<number, ForumNode>();
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      description: row.description,
      position: row.position,
      threadCount: row.threadCount,
      children: [],
    });
  }

  const roots: ForumNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId != null && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  cache = { byId, roots };
}

export async function getForumTree(): Promise<ForumNode[]> {
  if (!cache) await load();
  return cache!.roots;
}

export async function getForumNode(id: number): Promise<ForumNode | undefined> {
  if (!cache) await load();
  return cache!.byId.get(id);
}

/** Call after any forum create/edit/move (§05) — next read reloads from Postgres. */
export function invalidateForumTree() {
  cache = null;
}

/**
 * [forumId, parentId, grandparentId, ...] up to the root — the permission
 * model (§05) checks every level for an explicit deny, not just the
 * nearest one with a rule, so the full chain is what callers need, not
 * just the immediate parent.
 */
export async function getForumAncestorChain(forumId: number): Promise<number[]> {
  if (!cache) await load();
  const chain: number[] = [];
  let current = cache!.byId.get(forumId);
  while (current) {
    chain.push(current.id);
    current = current.parentId != null ? cache!.byId.get(current.parentId) : undefined;
  }
  return chain;
}
