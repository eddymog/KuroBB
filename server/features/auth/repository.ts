import { count, eq, or } from "drizzle-orm";

import { db } from "~server/db/client";
import { sessions, users } from "~server/db/schema";

export async function insertUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  isAdmin: boolean;
}) {
  const [row] = await db.insert(users).values(input).returning();
  return row;
}

export async function findUserByUsernameOrEmail(usernameOrEmail: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(or(eq(users.username, usernameOrEmail), eq(users.email, usernameOrEmail)));
  return row;
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(users);
  return row.n;
}

export async function insertSession(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const [row] = await db.insert(sessions).values(input).returning();
  return row;
}

// Joined lookup: the one query getCurrentUser() needs per request.
export async function findActiveSessionUser(tokenHash: string) {
  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash));
  return row;
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, tokenHash));
}

