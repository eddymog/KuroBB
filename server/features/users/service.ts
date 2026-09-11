import { throwAppError } from "~server/lib/errors";

import * as repo from "./repository";

export async function getPublicProfileOrThrow(id: number) {
  const user = await repo.findUserById(id);
  if (!user) {
    throwAppError("NOT_FOUND", `El usuario ${id} no existe.`);
  }
  // Public profile — never leak passwordHash/email/isAdmin to another user.
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    signature: user.signature,
    postCount: user.postCount,
    createdAt: user.createdAt,
  };
}

export async function updateOwnProfile(
  userId: number,
  input: { avatarUrl?: string | null; signature?: string | null },
) {
  return repo.updateProfile(userId, input);
}
