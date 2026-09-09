import { and, eq, inArray } from "drizzle-orm";

import { db } from "~server/db/client";
import { forumPermissions, forums, groups, userGroups, users } from "~server/db/schema";

export async function findGroupByName(name: string) {
  const [row] = await db.select().from(groups).where(eq(groups.name, name));
  return row;
}

export async function findGroupById(id: number) {
  const [row] = await db.select().from(groups).where(eq(groups.id, id));
  return row;
}

export async function listAllGroups() {
  return db.select().from(groups).orderBy(groups.id);
}

export async function removeUserFromGroup(userId: number, groupId: number) {
  await db
    .delete(userGroups)
    .where(and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId)));
}

export async function listGroupMembers(groupId: number) {
  return db
    .select({ id: users.id, username: users.username })
    .from(userGroups)
    .innerJoin(users, eq(userGroups.userId, users.id))
    .where(eq(userGroups.groupId, groupId));
}

/** Every forum, left-joined with this group's rule for it (null = no rule). */
export async function listForumPermissionsForGroup(groupId: number) {
  return db
    .select({
      forumId: forums.id,
      forumName: forums.name,
      canView: forumPermissions.canView,
      canPost: forumPermissions.canPost,
    })
    .from(forums)
    .leftJoin(
      forumPermissions,
      and(eq(forumPermissions.forumId, forums.id), eq(forumPermissions.groupId, groupId)),
    )
    .orderBy(forums.position, forums.id);
}

export async function insertGroup(name: string) {
  const [row] = await db.insert(groups).values({ name }).returning();
  return row;
}

export async function addUserToGroup(userId: number, groupId: number) {
  await db.insert(userGroups).values({ userId, groupId }).onConflictDoNothing();
}

export async function getUserGroupIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ groupId: userGroups.groupId })
    .from(userGroups)
    .where(eq(userGroups.userId, userId));
  return rows.map((r) => r.groupId);
}

export async function findPermissionRules(forumIds: number[], groupIds: number[]) {
  if (forumIds.length === 0 || groupIds.length === 0) return [];
  return db
    .select()
    .from(forumPermissions)
    .where(
      and(
        inArray(forumPermissions.forumId, forumIds),
        inArray(forumPermissions.groupId, groupIds),
      ),
    );
}

export async function upsertForumPermission(input: {
  forumId: number;
  groupId: number;
  canView?: boolean | null;
  canPost?: boolean | null;
}) {
  const [row] = await db
    .insert(forumPermissions)
    .values(input)
    .onConflictDoUpdate({
      target: [forumPermissions.forumId, forumPermissions.groupId],
      set: { canView: input.canView, canPost: input.canPost },
    })
    .returning();
  return row;
}
