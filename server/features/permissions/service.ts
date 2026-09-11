import { throwAppError } from "~server/lib/errors";

import { getForumAncestorChain } from "../forums/tree";
import * as repo from "./repository";

export const GUEST_GROUP = "Guest";
export const REGISTERED_GROUP = "Registered";

// Bootstrapped by the running app on first use — not a seed script, same
// pattern as auth/service.ts's first-user-becomes-admin. A fresh install
// creates these the moment they're first needed, not via a migration seed.
async function ensureGroup(name: string): Promise<number> {
  const existing = await repo.findGroupByName(name);
  if (existing) return existing.id;
  const created = await repo.insertGroup(name);
  return created.id;
}

/** Called once at registration (auth/service.ts) — every real account is a member. */
export async function assignToRegisteredGroup(userId: number) {
  const groupId = await ensureGroup(REGISTERED_GROUP);
  await repo.addUserToGroup(userId, groupId);
}

async function getEffectiveGroupIds(userId: number | null): Promise<number[]> {
  if (userId == null) {
    return [await ensureGroup(GUEST_GROUP)];
  }
  return repo.getUserGroupIds(userId);
}

export type Permission = "view" | "post";

/**
 * Resolve on read (§05) — no cache beyond whatever a single caller chooses
 * to memoize for its own request, since a moderator's deny needs to take
 * effect on the very next request, not whenever a cache expires.
 *
 * Walks the FULL ancestor chain, not just the nearest level with a rule:
 * any explicit deny anywhere in the chain, across any of the user's groups,
 * wins outright. No rule anywhere defaults to allow — a fresh forum is open
 * until an admin explicitly restricts it.
 */
export async function resolvePermission(
  user: { id: number; isAdmin: boolean } | null,
  forumId: number,
  permission: Permission,
): Promise<boolean> {
  if (user?.isAdmin) return true;

  const [chain, groupIds] = await Promise.all([
    getForumAncestorChain(forumId),
    getEffectiveGroupIds(user?.id ?? null),
  ]);

  const rules = await repo.findPermissionRules(chain, groupIds);
  const column = permission === "view" ? "canView" : "canPost";

  for (const rule of rules) {
    if (rule[column] === false) return false; // deny wins immediately, anywhere in the chain
  }
  return true; // explicit allow found, or no rule anywhere — both default to allowed
}

/** Route-boundary helper: throws FORBIDDEN (§06) instead of returning a bool. */
export async function requirePermission(
  user: { id: number; isAdmin: boolean } | null,
  forumId: number,
  permission: Permission,
): Promise<void> {
  const allowed = await resolvePermission(user, forumId, permission);
  if (!allowed) {
    // `permission` is the internal "view" | "post" identifier (Permission
    // type above), not forum copy — mapped to a Spanish verb for display
    // only, so the type itself stays untouched.
    const action = permission === "view" ? "ver" : "publicar en";
    throwAppError("FORBIDDEN", `No tienes permiso para ${action} este foro.`);
  }
}
