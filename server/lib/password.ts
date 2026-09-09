import argon2 from "argon2";

// One consistent tagged format for password_hash (§07): "mybb$<hash>" for a
// migrated account that hasn't logged in yet, "argon2$<hash>" for every real
// Argon2 hash otherwise — including accounts registered directly in KuroBB,
// which never produce a "mybb$" hash at all. mybbLegacyVerify itself lands
// in Phase 4 alongside the migration script; this file only owns the
// Argon2 half, used by every account regardless of origin.

export async function hashPassword(plaintext: string): Promise<string> {
  const hash = await argon2.hash(plaintext);
  return `argon2$${hash}`;
}

export async function verifyPassword(
  taggedHash: string,
  plaintext: string,
): Promise<boolean> {
  if (taggedHash.startsWith("argon2$")) {
    return argon2.verify(taggedHash.slice("argon2$".length), plaintext);
  }
  if (taggedHash.startsWith("mybb$")) {
    // A migrated account that hasn't upgraded yet — Phase 4's
    // mybbLegacyVerify() handles this tag. Not built yet.
    throw new Error(
      "mybb$-tagged password hashes require Phase 4's mybbLegacyVerify(), not yet implemented.",
    );
  }
  throw new Error(`Unrecognized password hash tag: ${taggedHash.slice(0, 10)}...`);
}
