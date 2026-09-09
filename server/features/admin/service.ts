import { throwAppError } from "~server/lib/errors";

import * as authRepo from "../auth/repository";
import { getForumOrThrow } from "../forums/service";
import * as forumsRepo from "../forums/repository";
import { invalidateForumTree } from "../forums/tree";
import * as permsRepo from "../permissions/repository";

// Everything here assumes the caller (a route loader/action) has already
// run requireAdmin(request) — kurobb-design.md §08's admin surface is
// site-wide, gated by the isAdmin flag directly, not the per-forum
// deny-overrides-allow model (§05), which has no single forum to check an
// admin action like "edit forum structure" against. Same pattern already
// used by /forums/new.

export async function listForumsForAdmin() {
  return forumsRepo.listAllForumsFlat();
}

export async function editForum(
  forumId: number,
  input: { name: string; description: string | null; parentId: number | null; position: number },
) {
  await getForumOrThrow(forumId); // 404s cleanly if it doesn't exist
  if (!input.name.trim()) {
    throwAppError("VALIDATION_ERROR", "Name is required.", [
      { field: "name", issue: "Name is required." },
    ]);
  }
  if (input.parentId === forumId) {
    throwAppError("VALIDATION_ERROR", "A forum cannot be its own parent.", [
      { field: "parentId", issue: "A forum cannot be its own parent." },
    ]);
  }
  const forum = await forumsRepo.updateForum(forumId, input);
  invalidateForumTree();
  return forum;
}

export async function deleteForumIfEmpty(forumId: number) {
  const forum = await forumsRepo.findForumById(forumId);
  if (!forum) {
    throwAppError("NOT_FOUND", `Forum ${forumId} does not exist.`);
  }
  if (forum.threadCount > 0) {
    throwAppError(
      "CONFLICT",
      `"${forum.name}" has ${forum.threadCount} thread(s) — move or delete them first.`,
    );
  }
  await forumsRepo.deleteForum(forumId);
  invalidateForumTree();
}

export async function listGroups() {
  return permsRepo.listAllGroups();
}

export async function createGroup(name: string) {
  if (!name.trim()) {
    throwAppError("VALIDATION_ERROR", "Group name is required.", [
      { field: "name", issue: "Group name is required." },
    ]);
  }
  const existing = await permsRepo.findGroupByName(name);
  if (existing) {
    throwAppError("CONFLICT", `A group named "${name}" already exists.`);
  }
  return permsRepo.insertGroup(name);
}

export async function getGroupDetailOrThrow(groupId: number) {
  const group = await permsRepo.findGroupById(groupId);
  if (!group) {
    throwAppError("NOT_FOUND", `Group ${groupId} does not exist.`);
  }
  const [members, forumRules] = await Promise.all([
    permsRepo.listGroupMembers(groupId),
    permsRepo.listForumPermissionsForGroup(groupId),
  ]);
  return { group, members, forumRules };
}

export async function addMemberToGroupByUsername(groupId: number, username: string) {
  await getGroupDetailOrThrow(groupId);
  const user = await authRepo.findUserByUsernameOrEmail(username);
  if (!user) {
    throwAppError("NOT_FOUND", `No user named "${username}".`);
  }
  await permsRepo.addUserToGroup(user.id, groupId);
}

export async function removeMemberFromGroup(groupId: number, userId: number) {
  await permsRepo.removeUserFromGroup(userId, groupId);
}

function parseTriState(value: string): boolean | null {
  if (value === "allow") return true;
  if (value === "deny") return false;
  return null; // "inherit" — no rule at this level
}

export async function setForumPermission(input: {
  forumId: number;
  groupId: number;
  canView: string;
  canPost: string;
}) {
  await getForumOrThrow(input.forumId);
  await getGroupDetailOrThrow(input.groupId);
  return permsRepo.upsertForumPermission({
    forumId: input.forumId,
    groupId: input.groupId,
    canView: parseTriState(input.canView),
    canPost: parseTriState(input.canPost),
  });
}
