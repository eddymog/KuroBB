import { throwAppError } from "~server/lib/errors";
import { hashPassword, verifyPassword } from "~server/lib/password";
import {
  clearSessionCookie,
  generateSessionToken,
  getSessionTokenFromRequest,
  hashSessionToken,
  serializeSessionCookie,
} from "~server/lib/session-cookie";

import { assignToRegisteredGroup } from "../permissions/service";
import * as repo from "./repository";

function parseSessionTtl(): number {
  const raw = process.env.SESSION_TTL ?? "30d";
  const match = /^(\d+)d$/.exec(raw);
  const days = match ? Number(match[1]) : 30;
  return days * 24 * 60 * 60 * 1000;
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}) {
  const existing = await repo.findUserByUsernameOrEmail(input.username);
  const existingByEmail = await repo.findUserByUsernameOrEmail(input.email);
  if (existing || existingByEmail) {
    throwAppError("CONFLICT", "That username or email is already registered.");
  }

  // Bootstrapping: the first account on a fresh install becomes admin
  // automatically — there's no setup wizard, and nothing else can grant
  // admin rights on an install with zero users. Standard pattern for
  // self-hosted software with no separate installer step.
  const isFirstUser = (await repo.countUsers()) === 0;

  const passwordHash = await hashPassword(input.password);
  const user = await repo.insertUser({
    username: input.username,
    email: input.email,
    passwordHash,
    isAdmin: isFirstUser,
  });
  await assignToRegisteredGroup(user.id);
  return user;
}

async function createSessionCookieHeader(userId: number): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + parseSessionTtl());
  await repo.insertSession({ userId, tokenHash: hashSessionToken(token), expiresAt });
  return serializeSessionCookie(token, expiresAt);
}

export async function login(input: {
  usernameOrEmail: string;
  password: string;
}): Promise<{ setCookieHeader: string }> {
  const user = await repo.findUserByUsernameOrEmail(input.usernameOrEmail);
  if (!user) {
    throwAppError("UNAUTHENTICATED", "Incorrect username/email or password.");
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throwAppError("UNAUTHENTICATED", "Incorrect username/email or password.");
  }

  const setCookieHeader = await createSessionCookieHeader(user.id);
  return { setCookieHeader };
}

export async function logout(request: Request): Promise<{ setCookieHeader: string }> {
  const token = getSessionTokenFromRequest(request);
  if (token) {
    await repo.revokeSessionByTokenHash(hashSessionToken(token));
  }
  return { setCookieHeader: clearSessionCookie() };
}

/**
 * The one lookup every loader/action calls when it needs to know who's
 * asking — runs fresh against `sessions` on every call, on purpose (§07):
 * a revoked/banned session has to stop working on the very next request,
 * not whenever some cache decides to expire.
 */
export async function getCurrentUser(request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;

  const row = await repo.findActiveSessionUser(hashSessionToken(token));
  if (!row) return null;
  if (row.session.revokedAt) return null;
  if (row.session.expiresAt.getTime() < Date.now()) return null;

  return row.user;
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throwAppError("UNAUTHENTICATED", "You need to be logged in to do that.");
  }
  return user;
}

/**
 * Gates /forums/new (closing the gap Phase 1 knowingly left open). This is
 * the `isAdmin` flag, not the full per-forum deny-overrides-allow model from
 * §05 — that needs a groups/permissions schema that was never added to §04.
 */
export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (!user.isAdmin) {
    throwAppError("FORBIDDEN", "Only an admin can do that.");
  }
  return user;
}
