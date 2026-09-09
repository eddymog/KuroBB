# Project: KuroBB — a standalone forum, with optional MyBB migration

Building a **new**, standalone forum platform (KuroBB) from scratch. MyBB is the
reference for which features actually matter (a real, aged forum's feature set) and,
separately, the source of an **optional**, one-time data migration for operators who
have an existing MyBB community to bring over.

**KuroBB never requires migration to function.** It works as a fresh, empty install the
way any forum software does on day one — forums, threads, and users get created through
the product itself. Migration is a capability layered on top, not a precondition: an
operator with a real MyBB install can import its users, forums, threads, and posts once;
an operator without one never touches the migration path at all.

There is **no live cutover** and no parallel operation between an old and new system —
this isn't a strangler fig. If migration is used, it's a one-time import (repeatable in
dev until it's right) into an already-working standalone product, not a gate the product
has to pass through before it's usable.

**Data integrity first, portfolio polish second.** The migrated data belongs to real
people. A choice that looks good on the architecture diagram but risks corrupting or
losing their accounts, posts, or passwords during import is the wrong choice.

**`kurobb-design.md` (KRB-001) is the source of truth for stack and architecture**, not
this file. It's the actively maintained doc, with companions `kurobb-checklist.md`
(KRB-002, build-phase tracking), `kurobb-frontend-alternatives.md` (KRB-003, the
rendering-architecture decision), and `kurobb-vs-nodebb.md` (KRB-004, the NodeBB
comparison). Where this file's Stack/Engineering-standards sections below disagree with
`kurobb-design.md`, `kurobb-design.md` wins — this file sets scope, priorities, and the
working agreement; it doesn't chase every architecture revision.

---

## Scope: the 20%

MyBB has fifteen years of features. The MVP is deliberately narrow:

- Forums, threads, posts, replies
- Auth + basic profiles (registration/login, avatar, signature, post count)
- BBCode / rich text formatting on posts

**Explicitly deferred, not built in the MVP:** moderation tools (lock, pin, delete, ban,
report queue), private messages, themes/theme engine, plugin system, calendar,
reputation system. Moderation needs to exist before any real public launch with real
users posting live — but it does not block building and validating the core MVP as a
standalone product first. No seed data, no migrated data required to validate it: create
a real forum and thread through the product itself, the way a fresh install would.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | Node.js 22 LTS, TypeScript, Express | Routers/controllers, folder-per-feature |
| Database | PostgreSQL 16 | Drizzle migrations |
| Data access | Drizzle ORM | Typed query builder; drop to raw SQL for thread-list/search |
| Legacy DB | MySQL (MyBB) | One-time import source only — not a live dependency after migration |
| Rendering | React Router (Framework Mode), mounted in Express | Superseded from an earlier separate Vite+React SPA — see `kurobb-design.md` §03/§13 for why and the current version. |
| Search | Postgres full-text + GIN | **Not** Elasticsearch — see below |
| Local dev | Docker Compose | Postgres + MySQL (loaded from a MyBB dump) for building and testing the import |

### Deliberately NOT in the stack

At the target scale, Postgres full-text search with a GIN index is comfortably
sufficient. No Elasticsearch, no Redis cache layer, no message broker, no microservices.

No reverse-proxy routing layer for now — that only earns its place if you later run this
forum alongside a live legacy install and need to route between them. Since this is a
one-time import into a fresh build rather than a phased cutover, drop it until (if ever)
that need actually shows up. A plain reverse proxy for TLS/static assets in production is
a normal deployment detail, not a migration mechanism — decide that separately when you
get to deployment.

Express over NestJS: a solo greenfield build doesn't need a DI container or decorator
ceremony for clean separation between features. A folder-per-feature convention
(`forums/`, `auth/`, `posts/`, each with its own router, service, and repository module)
gives the same boundaries with far less framework tax.

---

## Approach: build the standalone product, migration is optional and separate

1. **Core schema and forum browsing.** Forums, threads, posts, replies — built fresh
   against the new Postgres schema, no MyBB dependency at all. No seed data, no
   synthetic content — a real forum and thread get created through the product itself,
   the way any fresh install works.
2. **Auth + profiles.** Registration/login, avatar, signature, post count.
3. **BBCode / rich text formatting.** Parser and rendering pipeline for posts.
4. **(Optional) Data migration script.** For operators bringing over an existing MyBB
   community only — one-time import of the MyBB dump into the schema built in steps 1-3.
   Idempotent and resumable, since it will be run many times during development before
   it's trusted. An install that has no MyBB community to bring over skips this step
   entirely and is no less complete for skipping it.
5. **(Post-MVP) Moderation tools.** Required before any real public launch.

---

## Migration mechanics — the four things that matter

These apply once you're importing the real MyBB dump into the schema you've already
built — not as an ongoing live process.

### 1. Passwords

Passwords cannot be decrypted, and forcing a reset on import loses accounts entirely.
MyBB 1.8 typically stores `md5(md5(salt) + md5(password))` — **verify against this
specific installation's version**, since newer builds may use bcrypt.

Write a custom verifier for the legacy scheme (`mybbLegacyVerify(password, salt, hash)`)
and a small tagged-hash format (e.g. prefix stored hashes with `mybb$` vs `argon2$`) so
the auth layer knows which check to run. On successful first login with a `mybb$` hash,
re-hash the plaintext with Argon2 (via `argon2` / `@node-rs/argon2`) and overwrite.
Transparent upgrade, no user action, and old hashes drain out of the database over time.

### 2. Preserve original IDs

Import MyBB's `tid`, `pid`, `uid`, `fid` as the **primary keys** in the new schema, then
set the Postgres sequences above the current max. No live site's indexed URLs to
preserve here, but it keeps foreign key relationships a direct copy during import —
no ID-mapping table to build or maintain, and posts/threads/users carry the same
identity end to end.

### 3. BBCode

Store the **original MyCode as the source of truth** and rendered HTML as a separate,
regenerable cache column. Never convert destructively. When a parser bug surfaces later,
re-render everything rather than discover the originals are gone.

MyBB's MyCode includes custom tags, nested quotes, and years of malformed markup.
**Test the parser against a random sample of real posts early** — not against clean
examples. This is the single most common source of schedule overrun on this kind of
project.

### 4. Attachments

MyBB stores them on disk. Move to S3-compatible storage, verify checksums on both sides,
and keep the originals until the migration is verified as trustworthy.

### The migration script itself

Idempotent and resumable, not a one-shot — it will be run many times against the dump
during development.

- Always against a **dump**, never a live database
- Row-count and checksum verification per table, reported at the end
- Re-runnable without duplicating data

---

## Domain notes

- **Denormalized counters.** `reply_count` and `last_post_id` on a hot thread are a
  write-contention point. Decide explicitly between optimistic concurrency (a `version`
  column checked on update) and accepting the row lock, and document the reasoning.
- **Permissions.** Per-forum, per-group, inherited, with allow/deny precedence. This is
  the genuinely hard modeling problem. Resolve to an effective permission set per
  (user, forum) and cache it in-process.
- **Category tree.** Adjacency list vs. closure table vs. Postgres `ltree`. Pick one
  deliberately and write down why. Depth is shallow here, so simple probably wins.
- **Read/unread state.** Do **not** store a row per (user, thread) — that is a sparse
  matrix that grows without bound. Use a per-user watermark timestamp plus a small set of
  explicit exceptions, which is what mature forums do.

---

## Launch plan

**Standalone launch** — no MyBB community to bring over:

1. Build and validate the MVP as a real, empty-on-first-install product — no seed or
   synthetic data.
2. Launch. Moderation tools should land before this step if the forum will have real
   public traffic from day one.

**Launch with migration** — an operator bringing over an existing MyBB community, on top
of the same standalone product above:

1. Run the migration script against the real MyBB dump. Verify counts and checksums.
2. Spot-check imported data manually — thread/post rendering, BBCode edge cases,
   password login on a sample of migrated accounts.
3. Launch. Moderation tools should land before this step if the forum will have real
   public traffic from day one.

Migration is additive to the standalone launch plan, not a replacement for it — it
doesn't introduce a different product, just real data inside the same one.

---

## Engineering standards

- **Drizzle Kit** for every schema change. Migrations checked into version control, no
  implicit schema sync in any environment that matters.
- **Testcontainers (testcontainers-node)** with both Postgres and MySQL, so migration
  tests run against a real MyBB dump in CI. This is the highest-value test suite in the
  project.
- Drizzle's query builder for CRUD; raw SQL (via Drizzle's `sql` tag) for the thread-list
  and search queries where hand-tuned SQL matters.
- Server-side sessions, not JWT — a single httpOnly cookie referencing a `sessions` row.
  Superseded from an earlier JWT-based plan once SSR made cookies unavoidable and made
  JWT's main benefit (skipping a DB hit) moot — see `kurobb-design.md` §07 for why.
- Zod schemas for request/response validation at every route boundary, applied via a
  small validation middleware rather than a framework-specific decorator.
- Load a realistic anonymized MyBB dump into local dev. Never develop the migration path
  against synthetic data when real data with real edge cases is available.

---

## Working agreement with the AI assistant

**Write freely:** routers, services, moderation endpoints (when we get there), React
components, BBCode parser scaffolding, Docker and CI config, test fixtures.

**Do not write for me — explain the tradeoffs and let me decide:**
- the permission resolution model
- the category tree representation
- counter update strategy and locking approach
- read/unread watermark design

**I write the migration script myself.** It depends on this specific database's quirks,
and an unverified assumption there costs real user data. Help me verify it — suggest
checks, edge cases, and validation queries — but I write it and I run it.

**General:** push back when I am adding infrastructure this project does not justify.
Remind me to finish the core MVP before reaching for deferred features. If I am
gold-plating instead of getting the migration path solid, say so.
