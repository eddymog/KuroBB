import { createHash, randomBytes } from "node:crypto";
import { parseCookie, stringifySetCookie } from "cookie";

// A single httpOnly cookie holding an opaque session token — decided in
// kurobb-design.md §07. No JWT: the token is just a random value; the
// database (sessions.token_hash) is the source of truth, checked on every
// request. Phase 9 (account switching, future) changes this cookie's value
// to an array of {accountId, token} pairs plus which is active — the
// `sessions` table doesn't need to change for that, only this cookie shape.
const COOKIE_NAME = "kurobb_session";

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const cookies = parseCookie(header);
  return cookies[COOKIE_NAME] ?? null;
}

export function serializeSessionCookie(token: string, expiresAt: Date): string {
  return stringifySetCookie({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(): string {
  return stringifySetCookie({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
