import {
  bigint,
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// kurobb-design.md §04. Primary keys are plain serials for now — Phase 4's
// migration script preserves MyBB's own tid/pid/uid/fid instead of
// regenerating them (§09), which only matters once that script exists.

export const users = pgTable("users", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  // Tagged uniformly: "mybb$..." until a migrated account's first login,
  // "argon2$..." for every real Argon2 hash after that — including accounts
  // registered directly in KuroBB, which never see "mybb$" at all (§07).
  // One consistent format either way, not two.
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  signature: text("signature"),
  // Site-wide admin flag — deliberately separate from the groups/
  // forum_permissions system below. isAdmin bypasses per-forum permission
  // checks entirely rather than needing an "Admins" group with blanket
  // allow rules; groups are for the deny-overrides-allow model (§05).
  isAdmin: boolean("is_admin").notNull().default(false),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forums = pgTable("forums", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  // Adjacency list only — decided, §05. No path column, no closure table.
  parentId: bigint("parent_id", { mode: "number" }),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  // Denormalized, same atomic-increment pattern as threads.replyCount (§05).
  threadCount: integer("thread_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threads = pgTable("threads", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  forumId: bigint("forum_id", { mode: "number" }).notNull(),
  userId: bigint("user_id", { mode: "number" }),
  title: text("title").notNull(),
  // Denormalized — atomic `UPDATE ... SET reply_count = reply_count + 1`,
  // decided §05. Never read-modify-write in application code.
  replyCount: integer("reply_count").notNull().default(0),
  lastPostId: bigint("last_post_id", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  threadId: bigint("thread_id", { mode: "number" }).notNull(),
  userId: bigint("user_id", { mode: "number" }),
  // Original MyCode/BBCode source of truth (§08). bbob rendering lands in
  // Phase 3 — bodyHtmlCache stays null until then.
  bodyBbcode: text("body_bbcode").notNull(),
  bodyHtmlCache: text("body_html_cache"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
});

export const sessions = pgTable("sessions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  // Refresh/session token, hashed at rest — never store it raw (§07).
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// The per-forum, per-group deny-overrides-allow permission model from §05,
// finally given a real schema. Bootstrapped by the running app itself, not
// a seed script: "Guest" and "Registered" get created on first use, the
// same pattern as the first-user-becomes-admin bootstrap in auth/service.ts.
export const groups = pgTable("groups", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

export const userGroups = pgTable(
  "user_groups",
  {
    userId: bigint("user_id", { mode: "number" }).notNull(),
    groupId: bigint("group_id", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.groupId] })],
);

export const forumPermissions = pgTable(
  "forum_permissions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    forumId: bigint("forum_id", { mode: "number" }).notNull(),
    groupId: bigint("group_id", { mode: "number" }).notNull(),
    // Tri-state, not boolean: null = no rule at this (forum, group) level,
    // true = explicit allow, false = explicit deny. Absence of a row is the
    // same as null for every column — no rule anywhere defaults to allow
    // (a fresh forum is open; restriction is opt-in).
    canView: boolean("can_view"),
    canPost: boolean("can_post"),
  },
  (table) => [unique().on(table.forumId, table.groupId)],
);
