import { eq } from "drizzle-orm";

import { db } from "~server/db/client";
import { users } from "~server/db/schema";

export async function findUserById(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

export async function updateProfile(
  userId: number,
  input: { avatarUrl?: string | null; signature?: string | null },
) {
  const [row] = await db.update(users).set(input).where(eq(users.id, userId)).returning();
  return row;
}
