# KuroBB — Design Document (Barebones Build)

**Doc:** KRB-001 · **Rev:** 0.9 · **Status:** Two open questions, see §05 · **Date:** 2026-09-09

Rendering architecture decided in [kurobb-frontend-alternatives.md](./kurobb-frontend-alternatives.md) (KRB-003) — Option 4, React Router v8 mounted in Express. Compared against NodeBB in [kurobb-vs-nodebb.md](./kurobb-vs-nodebb.md) (KRB-004) — see §13.

黒 kuro — black, as in ink. A forum drawn fresh, not inherited.

---

## Table of contents

1. [Overview](#01-overview)
2. [Scope — the 20%](#02-scope--the-20)
3. [Architecture](#03-architecture)
4. [Data model](#04-data-model)
5. [Open decisions](#05-open-decisions)
6. [API surface](#06-api-surface)
7. [Auth & password migration](#07-auth--password-migration)
8. [BBCode & rich text](#08-bbcode--rich-text)
9. [Migration script](#09-migration-script)
10. [Build order](#10-build-order)
11. [Engineering standards](#11-engineering-standards)
12. [Reference implementation — mybb-sg](#12-reference-implementation--mybb-sg)
13. [Reference implementation — NodeBB](#13-reference-implementation--nodebb)

---

## 01. Overview

KuroBB is a forum platform built from scratch. MyBB is a reference for which features a
real, aged forum actually needs — not a codebase KuroBB inherits from.

There is no live cutover between the two. **KuroBB is a standalone product** — it works
as a brand-new, empty forum on its own, the way any forum software does on first
install, with no dependency on migrated data to be a complete product. Migration is a
separate, optional capability layered on top: a one-time way to bring an existing MyBB
community's users, threads, and posts into a KuroBB instance, for operators who have one
to bring over. That data belongs to real people when it's used: no account, password, or
post may be lost or corrupted in the move. Data integrity comes before portfolio polish
whenever the two pull in different directions — but the product itself never requires
migration to exist or function.

---

## 02. Scope — the 20%

MyBB carries fifteen years of features; most went unused on any given installation. The
barebones build keeps only what a forum cannot function without.

| Feature | Status | Note |
|---|---|---|
| Forums, threads, posts, replies | **In MVP** | The core browse/read/write loop. |
| Auth & basic profiles | **In MVP** | Register, log in, avatar, signature, post count. |
| BBCode / rich text | **In MVP** | Formatting on posts. |
| Moderation tools | Deferred | Lock, pin, delete, ban, report queue — required before real public launch, not before MVP. |
| Private messages | Deferred | Common dead weight on real MyBB installs. |
| Themes, calendar, reputation | Deferred | Not needed — no usage data suggests otherwise, and none are load-bearing for an RPG forum's actual needs. |
| Plugin marketplace / discovery ecosystem | Out of scope | The plugin/hook *mechanism* below is a real requirement; a NodeBB-style marketplace for discovering and installing third-party plugins is a different, much larger product surface this doesn't need. |
| Character sheets, techniques, missions, shop/economy (`sg/`) | Deferred | The live install's entire custom RP layer — see [§12](#12-reference-implementation--mybb-sg). Not vanilla MyBB, not touched until the barebones core ships. |
| Search | Deferred, next milestone | Not attachments-adjacent scope-creep — a committed next feature, not a maybe. Stack already commits to Postgres full-text + GIN (§03); not launch-blocking the way moderation is. |
| Account switching (multi-account, Gmail-style) | Deferred, future | Each account is one character; a user may run several. Not needed for MVP, but the session/auth schema (§04, §07) is deliberately kept forward-compatible with it now. |
| Plugin/hook ecosystem | Deferred, **required post-MVP** | Not a nicety — this is the mechanism modular RPG-specific features (character sheets, techniques, missions — `mybb-sg`'s `sg/` layer, §12) will actually be built as, rather than bolted into core. Modeled on NodeBB's three-hook-type taxonomy (filters/actions/static hooks, §13), not a single generic event type. Not built for the MVP itself, but §03's service-layer structure is already shaped for it. |
| Admin control panel | **Built (forum structure + groups/permissions); moderation and migration-review sections blocked on Phases 4–5** | Gated by `users.is_admin` directly, not the per-forum deny-overrides-allow model (§05) — an admin action like "edit forum structure" has no single forum to check that model against, and `is_admin` is specifically the site-wide bypass already decided for exactly this. A dedicated surface for admins (forum structure, groups/permissions — this is the real UI for the rules §05 designed) and, once Phase 5 exists, moderators (a consolidated home for the report queue and mod actions instead of scattered per-thread controls). Migration review needs Phase 4's run log, which doesn't exist yet either. |
| Attachments | Out of scope | Not relevant to this forum. |
| Real-time (WebSockets) | Priority, scope TBD | Named as important to the project, not just a future nicety — but whether it's a barebones-MVP requirement or the first post-MVP addition isn't settled yet. See §03 and the open question in §05 — NodeBB (§13) uses WebSockets as the primary transport for most of the app, not a bolt-on, which changes what "add WebSockets" actually means here. |

---

## 03. Architecture

| Layer | Choice | Notes |
|---|---|---|
| Backend | Node.js 22 LTS, TypeScript, Express | Folder-per-feature: `forums/`, `auth/`, `posts/`, each with its own router, service, and repository. This service layer is where permission checks, atomic counters, and `bbob` rendering live — see the plugin-system note below for why that matters beyond just the MVP. |
| Rendering | React Router v8, Framework Mode, mounted as Express middleware (`@react-router/express`) | One process, one deploy — not a separate frontend service. Real SSR: loaders fetch data server-side for reads, actions handle mutations. Chosen over Next.js specifically to keep the Express service layer above intact — see [kurobb-frontend-alternatives.md](./kurobb-frontend-alternatives.md) (KRB-003) for the full comparison. |
| Client data layer (barebones) | None — loaders/actions only | **Decided.** React Router's own client-side routing already gives no-full-reload navigation between pages (the NodeBB-like fluidity) with zero extra runtime — that's inherent to Framework Mode, not something TanStack Query adds. Adding a query cache here would cost bundle weight (LCP/INP) for capability the barebones core doesn't use: nothing here needs caching-across-visits, optimistic mutations, or out-of-band push updates. |
| Client data layer (RPG layer) | TanStack Query, scoped to an RPG-only layout route | **Decided.** The RPG layer (character sheets, techniques, etc. — see the scope note below) is mutation-heavy, stateful, interactive UI where caching and optimistic updates earn their keep, unlike the barebones pages. `QueryClientProvider` must live on a layout route scoped to the RPG section specifically, not the global root (`app/root.tsx`) — otherwise every barebones page pays for it anyway regardless of whether it's used. |
| Database | PostgreSQL 16 | Schema changes via Drizzle Kit migrations, checked into version control. |
| Data access | Drizzle ORM | Typed query builder for CRUD; raw SQL for thread-list and search. |
| Legacy DB | MySQL (MyBB dump) | One-time import source only — never a live dependency of the running app. |
| Search | Postgres full-text + GIN | Not Elasticsearch — the target scale doesn't justify it. |
| Real-time | Socket.IO, mounted on the same HTTP server as Express | NodeBB's own choice (§13), not picked in a vacuum — handles reconnection/fallback transports rather than hand-rolling raw `ws` connection management, same reuse-over-rebuild call as `bbob`. |

```
SINGLE PROCESS — Express, with React Router v8 mounted as middleware
  Browser --HTTP--> Express process
                       ├── React Router v8 loader/action  --calls-->  Express services
                       │      (renders the page — SSR, real HTML)      (auth, permissions,
                       │                                                counters, bbob)
                       └── Express services --Drizzle query--> Postgres
  Browser <--WebSocket (Socket.IO)--> same Express process --broadcasts in-process, no Redis

ONE-TIME IMPORT PATH (run many times before launch, never against a live DB)
  MyBB MySQL dump --export--> Migration script --bulk import, IDs preserved--> Postgres
```

Postgres is the only thing both paths touch. MySQL talks exclusively to the migration
script — never to the live app — so the legacy database can be dropped entirely once the
import is trusted. The browser only ever talks to the one Express process — there's no
separate frontend origin anymore, which is why §07's CORS section is gone.

Deliberately excluded for now: Elasticsearch, a Redis cache layer, a message broker,
microservices, and any reverse-proxy routing layer — that last one only earns its place
if KuroBB ever needs to run alongside a live legacy install, which this build does not.

**Redis stays out for now, but WebSockets is the one thing that could reopen that.**
NodeBB's own docs (§13) are explicit: Redis becomes mandatory the moment you run more
than one instance, because a single Socket.IO server can broadcast in-process, but two
instances behind a load balancer each only see the connections attached to them —
without a shared pub/sub bus, a message from a user connected to instance A never
reaches a user connected to instance B. At a single process and 100 DAU, that's not a
real constraint yet — but it's the specific, concrete trigger to revisit Redis, not a
vague "if we ever get bigger."

**Plugin system, forward-looking (§02):** not built now, but worth naming why the
folder-per-feature service layer above is the right shape for it later. `mybb-sg`'s real
hook-based plugins (`inc/plugins/tecnicatag.php`, `hidetag.php`) work because MyBB's core
calls `$plugins->run_hooks('name')` at defined points and plugins register against those
names — a clean seam. Its `sg/` layer, by contrast, bypasses that entirely and just
includes `global.php` directly from standalone scripts, which is *why* it's a large,
hard-to-extend-safely custom layer rather than a set of plugins. Keeping business logic
in named Express service functions (already the plan, not a new decision) is what
preserves the option to add real hook points later — a `hooks.run('thread.created', …)`
call inside a service function is a small addition; retrofitting hook points into logic
that was never factored into services in the first place is not.

### Local development

Docker Compose, Postgres always-on, MySQL behind a profile so it's not part of the
everyday loop:

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  mysql:
    image: mysql:8
    profiles: ["migration"]   # only starts with --profile migration
    ports: ["3306:3306"]
```

`docker compose up` gives you the one live dependency the running app actually has.
MySQL only comes up on demand (`docker compose --profile migration up`) while working on
or re-running the migration script — it never sits in the background otherwise, which is
the same claim §09's diagram already makes, just enforced in the dev setup too.
Testcontainers (§11) spins up its own ephemeral instances for tests, kept separate from
this so CI never touches manually-poked-at dev data.

One `npm run dev` starts the whole app — Express with React Router v8's dev integration
mounted in it — rather than a frontend dev server and an API running as two separate
commands. The exact dev-server wiring (React Router v8's Vite integration inside a
custom Express server) should be confirmed against the current official template when
this is actually scaffolded, the same way the Astro integration story in KRB-003 was
left unverified rather than assumed.

### Configuration

Two separate env files, split along the same boundary as the diagram above:

```
# .env — the running app
DATABASE_URL=postgres://...
SESSION_COOKIE_SECRET=<openssl rand -hex 32>
SESSION_TTL=30d
PORT=3000
NODE_ENV=development
```

No `CORS_ORIGIN` — that was only needed when the browser talked to a separate frontend
and a separate API on different origins. With React Router v8 mounted in the same
Express process, the browser has exactly one origin to talk to; CORS only comes back if
a future public API or mobile client (§10) needs cross-origin access, and that's a
decision for whenever that actually happens, not now.

The migration script gets its own env (`migration/.env`), holding `MYSQL_URL` and
nothing else. That's deliberate, not incidental: the running app should never even be
*able* to load a MySQL connection string, which is what actually enforces "MySQL never
talks to the live API" rather than just documenting it. Argon2 cost params are hardcoded
constants in code, not env vars — nothing here needs to vary per environment.

---

## 04. Data model

Primary keys carry over from MyBB's own IDs (`tid`, `pid`, `uid`, `fid`) rather than
being regenerated — see [§09](#09-migration-script). Fields below are the barebones set;
anything not listed is out of scope until the deferred features in §02 are picked back
up.

**users**

| Field | Note |
|---|---|
| `id` | MyBB `uid`, preserved as primary key |
| `username` | Unique, display name |
| `email` | Unique |
| `password_hash` | Tagged: `mybb$…` until first login, `argon2$…` after — see §07 |
| `avatar_url` | Nullable, plain string set by the user — a pasted link, not an upload. See §06. |
| `signature` | Raw BBCode, nullable |
| `post_count` | Denormalized counter |
| `created_at` | Preserved from MyBB on import |

**forums**

| Field | Note |
|---|---|
| `id` | MyBB `fid`, preserved |
| `parent_id` | Self-referencing adjacency list — decided, §05. No path column, no closure table. |
| `name` | |
| `description` | |
| `position` | Sort order within parent |
| `thread_count` | Denormalized, same atomic-increment pattern as `reply_count` below — backs pagination totals, §06 |

**threads**

| Field | Note |
|---|---|
| `id` | MyBB `tid`, preserved |
| `forum_id` | FK → forums.id |
| `user_id` | FK → users.id (thread starter) |
| `title` | |
| `reply_count` | Denormalized — atomic `UPDATE … SET reply_count = reply_count + 1`, decided in §05 |
| `last_post_id` | Denormalized, same update, backs pagination totals for `/threads/:id` (§06) |
| `created_at` | Preserved from MyBB on import |

**posts**

| Field | Note |
|---|---|
| `id` | MyBB `pid`, preserved |
| `thread_id` | FK → threads.id |
| `user_id` | FK → users.id |
| `body_bbcode` | Original MyCode / BBCode source of truth |
| `body_html_cache` | Rendered, regenerable — never authoritative |
| `created_at` / `edited_at` | |

**sessions** (server-side refresh tokens)

| Field | Note |
|---|---|
| `id` | |
| `user_id` | FK → users.id |
| `token_hash` | Refresh token, hashed at rest |
| `created_at` | |
| `expires_at` | |
| `revoked_at` | Nullable — set on logout |

One row per issued session, not one column on `users` — deliberately, so a single
browser can hold more than one active session at a time. Each account is one character
here, and a user may run several; account switching (§02) means letting one browser
juggle sessions for multiple accounts, Gmail-style, without re-entering credentials.
That's a client-side feature to build later, but it only works if the schema never
assumed "one session per user" to begin with — a `sessions` table keyed by session
already supports it for free, regardless of how the session id reaches the server (see
§07 — that transport mechanism changed with the rendering architecture, this table
didn't need to).

**groups** / **user_groups** / **forum_permissions** — the schema §05's permission
semantics were designed against but never actually added here until built in Phase 2.

| Table | Field | Note |
|---|---|---|
| `groups` | `id`, `name` | Bootstrapped by the app on first use (`Guest`, `Registered`), not a seed script — same pattern as the first-user-becomes-admin bootstrap in §07. |
| `user_groups` | `user_id`, `group_id` | Many-to-many, composite PK. Every registered account joins `Registered` at signup. |
| `forum_permissions` | `id`, `forum_id`, `group_id`, `can_view`, `can_post` | Tri-state per column: `null` = no rule at this (forum, group) pair, `true`/`false` = explicit allow/deny. Absence of any row is the same as all-null. Unique on `(forum_id, group_id)`. |

Resolution (§05's deny-overrides-allow, finally implemented): walk the **full** forum
ancestor chain — not just the nearest level with a rule — collect every explicit rule
across every group the user belongs to at every level, and any single explicit deny
anywhere in that collection wins outright. No rule anywhere defaults to **allow**: a
fresh forum is open until an admin explicitly restricts it, matching the "standalone
product works out of the box" principle in `claude.md`. `users.is_admin` bypasses this
system entirely rather than needing an "Admins" group with blanket-allow rules — the two
mechanisms are deliberately separate.

---

## 05. Open decisions

The original four calls this section made are all resolved below (marked **Decided**).
Two new ones surfaced from comparing this doc against NodeBB (§13) and are genuinely
open — product-shape calls, not something to default on quietly.

### Permission resolution model

Per-forum, per-group, inherited — the genuinely hard modeling problem here.

**Merge semantics: decided — deny-overrides-allow.** If any group a user belongs to, or
any forum in the inheritance chain, explicitly denies a permission, that denial wins
regardless of how permissive other groups or ancestor forums are. This is a deliberate
departure from MyBB's own default (confirmed in `mybb-sg/inc/functions.php`,
`fetch_forum_permissions()`): MyBB merges multiple groups by taking the **most
permissive** value across them, so a lenient group can silently restore access a
moderator meant to revoke via a stricter one. Deny-overrides-allow makes an explicit
denial — e.g. locking one user out of one forum — stick no matter what else is true
about them.

**Computation: decided — resolve on read, memoized per request only.** Compute the
effective (user, forum) permission at request time via a straightforward indexed query;
memoize within a single request so the same forum isn't recomputed twice while
rendering one page, but nothing persists across requests.

No persistent cache and no materialized table: deny-overrides-allow exists so a
moderator's revocation sticks immediately, and any cache layer beyond one request opens
a window where a just-revoked permission is still honored — a stale allow surviving a
deny is a security bug, not a UX nit. A materialized table is the worse fit of the two,
since it needs correct rebuild triggers on every group edit, forum-permission edit, and
membership change to avoid exactly that staleness. At this project's scale, an indexed
permission check is cheap enough that avoiding the infrastructure is the right call —
same reasoning as skipping Redis and Elasticsearch elsewhere in this doc. Revisit only
if a measured slow endpoint says otherwise.

### Category tree representation

**Decided — plain adjacency list, nothing else.** `parent_id` on `forums` (as already
modeled in §04) is the whole schema: no closure table, no Postgres `ltree`, and not even
MyBB's own `parentlist` materialized-path trick.

At a hard ceiling of ~200 forums and <100 DAU, none of that infrastructure earns its
keep. A closure table and `ltree` both exist to make deep or arbitrary-depth tree
queries fast at row counts where a recursive query would be too slow — 200 rows never
gets there. MyBB's `parentlist` column solves a different problem (cheap ancestor
checks via string-splitting in PHP, avoiding a query per permission check); Express can
just load the full forum table into an in-memory `Map<id, {parent_id, children[]}>` and
walk pointers for breadcrumbs/subtrees, refreshed whenever an admin creates or moves a
forum. At this traffic level, even querying the full table fresh on every request would
be fast enough — a cache here is a nicety, not a requirement.

### Counter update strategy

**Decided — atomic `UPDATE` increment, in the same transaction as the post insert:**

```sql
UPDATE threads SET reply_count = reply_count + 1, last_post_id = $1 WHERE id = $2;
```

`reply_count` and `last_post_id` on a hot thread are a write-contention point — and
MyBB's own `update_thread_counters()` (`mybb-sg/inc/functions.php`) gets it wrong: it
reads the current count in application code, increments it in PHP, then writes it back,
with no lock or transaction. Two replies posted to the same thread near-simultaneously
can both read the same value and both write the same incremented result — one reply
silently uncounted. A single atomic `UPDATE ... SET col = col + 1` avoids that class of
bug entirely: Postgres serializes concurrent updates to the same row on its own, so
there's no read-modify-write round trip in application code to get wrong.

Optimistic concurrency (a `version` column, retry on conflict) exists to avoid holding a
lock under real contention — irrelevant at <100 DAU, where two replies to the same
thread within milliseconds of each other essentially never happens. Recomputing on read
(`COUNT(*)` on demand) trades a free integer read on the most-viewed page in the forum
(the thread list) for a query, to dodge a problem the atomic update already solves for
free. Neither buys anything here.

### Read/unread watermark design

**Decided — per-forum watermark + time-bounded per-thread exceptions, registered users
only:**

```
forum_reads  (user_id, forum_id, read_at)   -- upserted when a user catches up on a forum
thread_reads (user_id, thread_id, read_at)  -- upserted when a user opens a thread
```

A thread is unread if `thread.last_post_at` is newer than the user's `thread_reads` row
for it (when the thread's activity is within a cutoff — 7 days, matching MyBB's
`threadreadcut`), otherwise their `forum_reads` row for its forum, otherwise unread by
default (never visited). Past the cutoff, a thread's individual row stops being
checked and the forum watermark alone decides it — no cleanup job needed, rows outside
the window simply stop mattering rather than needing deletion.

This mirrors `mybb-sg`'s actual tables (`forumsread`, `threadsread` in
`inc/functions_indicators.php`) almost exactly, which is real confirmation this is what
mature forums converge on, not just a claim. The one deliberate deviation: MyBB also
tracks unread state for guests via serialized cookies, since it ships as general-purpose
software that has to support anonymous browsing. KuroBB drops that tier — unread
tracking is a registered-user convenience, not a feature guests need, and skipping it
removes a whole cookie-parsing fallback path for no real loss.

A row per (user, thread) with no bound at all — the option this replaces — was ruled
out because it never stops growing; the cutoff above is what keeps this version bounded
in practice.

### Real-time transport shape — open

WebSockets being important (§02) doesn't by itself say *how* they're used, and NodeBB
(§13) makes a specific, non-obvious choice here worth naming directly: it doesn't use
Socket.IO as a bolt-on notification channel bolted next to a normal request/response
app — it SSRs the first page load (for SEO, no-JS support), then upgrades to a
persistent WebSocket connection that carries most *subsequent* navigation and
interaction, not just live notifications. That's a materially different shape from what
§03/§06 currently describe (React Router v8 loaders/actions over plain HTTP, with
Socket.IO handling only real-time push).

- **Option A — WebSocket as a bolt-on.** Keep §06 exactly as designed: HTTP
  loaders/actions for everything, Socket.IO strictly for live push (new-reply
  notifications, an unread-count badge updating without a refresh, maybe presence).
  Smallest change from the current design; real-time is additive, not load-bearing.
- **Option B — WebSocket as the primary transport, NodeBB-style.** SSR the first load
  of a page for SEO, then route most interaction (posting, pagination, navigation)
  over the socket instead of new HTTP requests. Closer to what "a simpler NodeBB clone"
  literally means, but a bigger architectural commitment — most of §06's loaders/actions
  would need a socket-message equivalent alongside the HTTP one.

Not deciding this here. It changes real surface area in §06, so see
[kurobb-vs-nodebb.md](./kurobb-vs-nodebb.md) (KRB-004) for the fuller tradeoff before
picking.

### Post format: BBCode vs. Markdown for new posts — open

`body_bbcode` (§04, §08) was decided back when this project was purely a MyBB
migration. NodeBB (§13) doesn't use BBCode at all — it defaults new posts to Markdown.
That's worth surfacing plainly now that NodeBB is an explicit reference: MyBB-imported
content has to stay BBCode (it's what the dump contains, and §08's rule — store the
original source, never convert destructively — doesn't change). What's actually open is
whether *new* posts written directly in KuroBB should also be BBCode, or Markdown like
NodeBB, with both formats coexisting (tagged per-post, the same way `password_hash` is
tagged `mybb$`/`argon2$` in §04). Not deciding here — see KRB-004.

---

## 06. API surface

Not a separate REST API anymore — React Router v8 routes, each backed by a loader
(read) or action (write) that calls straight into the Express service layer (§03). The
barebones route set below is enough to serve §02's scope and nothing past it; exact
loader/action syntax should be checked against current React Router v8 docs when this
is scaffolded, same caveat as the dev-server wiring in §03.

| Route | loader / action | Purpose |
|---|---|---|
| `/auth/register` | action | Create account |
| `/auth/login` | action | Session start; runs MyBB legacy verify + upgrade on first login; sets the session cookie (§07) |
| `/auth/logout` | action | Revoke the current session (`sessions.revoked_at`), clear it from the cookie |
| `/forums` | loader | List forum tree — SSR'd, crawlable |
| `/forums/new` | action | Create a forum/category — see the note below |
| `/forums/:id` | loader | Thread list for a forum — paginated, SSR'd |
| `/forums/:id/new` | action | Create thread |
| `/threads/:id` | loader | Thread with its posts — posts paginated, SSR'd, real per-thread `<title>`/meta tags |
| `/threads/:id` | action | Reply |
| `/posts/:id/edit` | action | Edit; re-renders `body_html_cache` |
| `/users/:id` | loader | Public profile — SSR'd |
| `/settings` | loader + action | View/update own avatar (URL string) / signature |

No `/auth/refresh` route: a loader running on every request can just check the session
cookie's validity directly against the `sessions` table server-side — there's no
separate client-held access token to rotate anymore (§07).

**`/forums/new` exists so KuroBB never needs seed data to be a real product** — a fresh
instance gets its first forum the same way any operator would, through the product
itself, not a fake-content script (§10.1). It ships intentionally **ungated** in Phase 1,
because Phase 1 has no auth yet (§10.2) to gate it against. That's a known, temporary gap,
not an oversight: §05's deny-overrides-allow permission model checks *per-forum*
permissions, but creating a *new, top-level* forum is a site-wide action with no existing
forum to check against — it needs a site-level admin concept that doesn't exist yet.
Gating this route is Phase 2's job once auth exists, and the real shape of "site admin"
(a flag on `users`, a reserved group, something else) is a decision for then, not now.

No upload endpoint for avatars — `avatar_url` is set by pasting a link, not a file
upload. Standing up S3-compatible storage for avatar uploads after ruling attachments
out as unnecessary infrastructure (§02) would reintroduce the same category of thing for
a much smaller feature. File-upload avatars are a deliberate future addition (§10) if
wanted later, not a barebones requirement.

### Pagination

Page-number offset pagination — `?page=1&per_page=20` — not cursor/keyset. Cursor
pagination solves drift in high-insert-rate feeds a user is actively scrolling; a
thread's post list is append-only and conventionally paged by number anyway (MyBB itself
uses `showthread.php?tid=X&page=Y`), so page numbers are the expected UX, not just the
simpler implementation.

```json
{ "data": [ /* … */ ], "page": 1, "per_page": 20, "total": 134, "total_pages": 7 }
```

`total`/`total_pages` read from a denormalized counter, not a `COUNT(*)`: `reply_count`
on `threads` already covers `/threads/:id`, and `forums` gains a `thread_count` column
(§04) for `/forums/:id/threads`, updated with the same atomic `UPDATE … SET
thread_count = thread_count + 1` pattern already decided for `reply_count` in §05.

### Error responses

One envelope, produced by a single centralized Express error middleware — routes throw
or `next(err)`, never format their own error JSON:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Email is invalid", "details": [{ "field": "email", "issue": "Invalid email address" }] } }
```

A small `AppError { code, httpStatus, message, details? }` is thrown from services and
caught centrally. Status codes follow decisions already made elsewhere in this doc
rather than being invented fresh: `401` unauthenticated, `403` a deny-overrides-allow
permission failure (§05), `404` missing resource, `409` duplicate username/email on
register, `400` a Zod validation failure (Zod's structured issues map directly into
`details`), `500` everything unexpected, with no internals leaked to the client.

---

## 07. Auth & password migration

Passwords cannot be decrypted, and forcing a reset on import loses accounts. MyBB 1.8
typically stores `md5(md5(salt) + md5(password))` — verify against the specific dump's
version before relying on this.

```
mybbLegacyVerify(password, salt, hash) → boolean

on successful login with a "mybb$" hash:
  re-hash plaintext with Argon2 (argon2 / @node-rs/argon2)
  overwrite as "argon2$…"
  → transparent upgrade, no user action
```

One session per row in `sessions` (§04), not a singleton per user, is the load-bearing
choice: it's what lets account switching (§02, §10) land later as a client feature
rather than a schema migration — that part is unchanged by anything below.

### Session transport — revised for SSR

**Decided — a single httpOnly session cookie holding an opaque session id, validated
against the `sessions` table on every request. No JWT.**

This reverses the earlier bearer-token plan, and it's worth being explicit about why,
since it also quietly drops `jsonwebtoken` from the stack — not just the transport:

- **SSR forces cookies, full stop.** A React Router v8 loader runs server-side, before
  any client JS exists; it can only see what arrived with the request. A bearer token
  held in browser memory or `localStorage` is invisible to it. This part was already
  flagged when Option 4 was chosen (KRB-003).
- **Once the cookie exists, JWT stops earning its place.** JWT's whole value is
  verifying a session *without* a database hit — that mattered when a separate Express
  API might be called by a client holding nothing but the token. Here, every loader
  already queries Postgres for the page's actual content on every request; checking
  `sessions.expires_at`/`revoked_at` is one more indexed lookup on a query path that's
  already hitting the database. Signing, verifying, and expiring a JWT on top of that
  is machinery with nothing left to justify it.
- **Account switching still works the same way it always would have.** The cookie
  holds a small array of session ids (one per linked account) plus which is active —
  same idea as the bearer-token version, just sitting in a cookie instead of client
  state. `sessions` didn't need to change for this either way (§04).

**This walks back the `jsonwebtoken` + Passport (`passport-jwt`) line from earlier in
this section** — flagging it plainly rather than leaving a stale decision standing.
Passport can still be used for the login flow's credential-checking strategy if you want
its structure; what's gone is JWT as the session format itself.

No CORS section needed here anymore — see §03's note that the browser only ever talks to
one origin now.

---

## 08. BBCode & rich text

`body_bbcode` is the source of truth; `body_html_cache` is regenerable and never
authoritative. When a parser bug surfaces later, re-render everything rather than
discover the originals are gone.

MyBB's MyCode includes custom tags, nested quotes, and years of malformed markup. Test
the parser against a random sample of real imported posts early — not clean examples —
since this is the most common source of schedule overrun on a project like this.

**Decided — `bbob` (`@bbob/core` + `@bbob/html` + `@bbob/preset-html5`), not a
hand-rolled parser.** Regex-based BBCode parsers break specifically on nesting —
`[quote][quote]…[/quote][/quote]` — because regex can't track matching depth, which is
exactly the failure mode this section warns about. `bbob` tokenizes into a real AST
first, so nested tags are handled correctly by construction, it's tolerant of
malformed/unclosed tags rather than throwing, and its plugin mechanism supports custom
tag processors — needed later for the equivalents of `mybb-sg`'s
`tecnicatag.php`/`hidetag.php` (§12). Reproducing that robustness by hand for fifteen
years of real malformed posts is effort a maintained library already spent; reuse is the
pragmatic call here, not the corner-cutting one. (`@bbob/core` alone doesn't render
anything — it needs `@bbob/html` supplied as its render function, confirmed by reading
`@bbob/core`'s source rather than assumed; easy to miss since `@bbob/core`'s own
`.process()` silently succeeds with an empty string instead of erroring.)

**`sanitize-html` as a mandatory allowlist pass on bbob's output — not optional
hardening, a fix for a confirmed vulnerability.** `bbob`'s HTML renderer does zero HTML
escaping of its own. Verified directly: a `[script]alert(1)[/script]` "BBCode" tag
renders as a literal, executing `<script>` element, and the html5 preset's own `[img]`
handler passes arbitrary attacker-supplied attributes straight through (an injected
`onerror` included) even for tags bbob considers "known and safe." `bbob` tokenizes
BBCode correctly; it does not make the output safe to serve. `sanitize-html` runs on the
rendered output as a strict allowlist — only the tags/attributes/styles/URL schemes the
html5 preset can legitimately produce, everything else stripped — matching this
project's existing deny-by-default posture (§05, §07). `body_bbcode` keeps the original
text forever regardless, attack payloads included, per this section's own rule; only
`body_html_cache` is affected.

---

## 09. Migration script

Idempotent and resumable — it runs many times against the dump before launch, never
against a live database.

1. **Read-only against a dump.** Never the live MySQL install, if one still exists.
2. **Preserve original IDs.** Import `tid`/`pid`/`uid`/`fid` as primary keys, then bump the Postgres sequences above the current max.
3. **Verify per table.** Row counts and checksums, reported at the end of every run.
4. **Re-runnable without duplicating data.** An upsert on the preserved ID, not a blind insert.

The dump's schema is not vanilla MyBB — see [§12](#12-reference-implementation--mybb-sg)
for the custom RP tables sitting alongside the standard ones. Decide explicitly whether
the barebones import touches those tables at all, or leaves them for when the deferred
RP features get picked back up.

---

## 10. Build order

1. **Core schema & browsing** — forums, threads, posts, replies, as a fresh, empty
   standalone install. No synthetic/seed data — KuroBB works the way any forum software
   does on first install, with nothing in it until real forums are created through the
   product itself.
2. **Auth & profiles** — registration, login, avatar, signature, post count.
3. **BBCode / rich text** — parser and rendering pipeline.
4. **Migration script** — import the real MyBB dump into the schema built above; verify, spot-check, repeat.
5. **(Post-MVP) Moderation** — required before any real public launch.
6. **(Post-MVP) Search** — full-text search across threads/posts via Postgres FT + GIN (§03). Not launch-blocking like moderation, but a committed next feature, not a someday-maybe.
7. **(Post-MVP) Plugin/hook ecosystem** — a hook registry modeled on NodeBB's three types (filters/actions/static hooks, §13), with named hook points added to the Express services (§03) as real needs show up, and a way to activate/deactivate a plugin's registrations. Modeled on `mybb-sg`'s actual `inc/plugins/*.php` pattern (§12) for what a hook-built feature looks like, not its `sg/` layer, which is the cautionary example of skipping this and bolting features on directly instead. A firm requirement — this is how RPG-specific modular features (character sheets, techniques, missions) get built later — just not for the MVP itself.
8. **(Post-MVP) Admin control panel** — a dedicated surface for admins (forum structure, groups/permissions, reviewing the migration's results) and moderators (a home for Phase 5's report queue and mod actions). Also a firm requirement, also not MVP-blocking.
9. **(Future) Account switching** — multi-account, Gmail-style session juggling on one browser. The `sessions` table (§04) is already shaped to allow it; this step is the client-side UX and the `/auth` flows to add/switch accounts without re-authenticating each one.
10. **(Future) File-upload avatars** — replaces the barebones URL-string `avatar_url` (§06) with real uploads, if wanted. Brings object storage into the stack for the first time — not needed until this is picked up.

---

## 11. Engineering standards

| Area | Standard |
|---|---|
| Schema | Drizzle Kit migrations, checked into version control — no implicit sync anywhere that matters. |
| Testing | Testcontainers (Postgres + MySQL); migration tests run against a real MyBB dump in CI — the highest-value suite in the project. |
| Queries | Drizzle's query builder for CRUD; raw SQL via Drizzle's `sql` tag for thread-list and search. |
| Validation | Zod schemas at every route boundary, applied via middleware. |
| Dev data | A realistic anonymized MyBB dump in local dev — never synthetic data for the migration path. |

---

## 12. Reference implementation — mybb-sg

`mybb-sg` (sibling directory, `../mybb-sg`) is the actual live installation this
project traces back to — not vanilla MyBB. It's a heavily customized MyBB 1.8
anime/ninja-style roleplay forum (Spanish-language: *fichas*, *técnicas*, *misiones*),
with a large custom application layer built on top of core MyBB rather than replacing
it. Treat it as ground truth to check a generic MyBB assumption against, not as a
roadmap to build toward yet — none of what's below is in scope until the deferred RP
features in §02 are picked back up.

Where to look:

| Area | Path | Relevance |
|---|---|---|
| Custom application layer | `sg/` | Character sheets (`ficha.php`, `nueva_ficha.php`), techniques (`tecnicas*.php`), missions (`misiones.php`), training (`entrenamientos.php`), inventory/shop/economy (`inventario.php`, `objetos.php`, `armas.php`, `tienda.php`, `intercambios.php`), NPCs, and staff tools (`sg/admin/`). |
| Domain helpers | `sg/functions/sg_functions.php` | Shared functions across the custom pages — the closest thing to a domain model for the RP systems (currency, XP, change-history events). |
| Post rendering | `inc/functions_post.php` | Custom postbit behavior, likes, and clan/ficha tagging on threads — relevant if KuroBB's post model ever needs to carry similar per-post metadata. |
| Custom MyCode | `inc/plugins/tecnicatag.php`, `inc/plugins/hidetag.php` | Forum-specific tags layered on stock BBCode — concrete evidence for the §08 warning that the parser needs to survive non-standard tags, not just clean MyCode. |
| Schema | `docs/shinobi9_mybb.sql` — the real dump | This install's table prefix is `mybb_sg_` for *everything*, standard MyBB tables included (`mybb_sg_forums`, `mybb_sg_users`, …) — that's a site config value, not a marker of custom tables. The actual custom RP tables are double-prefixed: `mybb_sg_sg_fichas`, `mybb_sg_sg_tecnicas`, `mybb_sg_sg_misiones_lista`, etc. §09's migration script needs an explicit decision on whether those `sg_sg_*` tables are imported now or left for later. |

None of `sg/`'s features are in the barebones scope — they're the concrete, real-world
version of everything §02 currently defers. When a generic MyBB assumption in this
document needs verifying (an edge case in BBCode, a permission check, a schema field),
`mybb-sg` is the place to confirm it against the actual installation rather than MyBB's
stock behavior.

---

## 13. Reference implementation — NodeBB

Where `mybb-sg` is the legacy source of truth, NodeBB is the modern one — a real,
mature, actively maintained Node.js forum (GPLv3, open source) used here to
sanity-check KuroBB's choices against production software solving the same problem,
not as something KuroBB forks or vendors.

| Area | NodeBB's approach | Relevance to KuroBB |
|---|---|---|
| Backend | Node.js + Express, a "layered monolith" organized into domain modules (User, Topics, Posts, Categories, Messaging, Plugins, Privileges) | Validates §03's folder-per-feature Express structure directly — NodeBB is proof this shape scales to a full-featured forum, not just a barebones one. |
| Database | Pluggable: Redis, MongoDB, or PostgreSQL behind one identical internal API — the app code never branches on which | Confirms Postgres is a legitimate NodeBB-caliber choice, not a downgrade from what "real" forum software uses. |
| Real-time | Socket.IO for live interactions and notifications; **Redis becomes mandatory only for horizontal scaling** (shared session store + inter-process pub/sub) | Directly informs §03's Redis caveat — single-instance KuroBB doesn't need it, multi-instance KuroBB would, for the same reason NodeBB does. |
| Sessions | Server-side session store (not JWT) | Independent confirmation of §07's server-side-sessions decision — this is the same conclusion NodeBB's own architecture reaches. |
| Post format | Markdown by default, not BBCode | The source of the open question in §05 — raised there, not decided here. |
| Plugins | Three hook types — **filters** (transform content passing through), **actions** (fire-and-forget side effects), **static hooks** (blocking — a plugin does async work before execution resumes) | **Decided — required post-MVP (§02, §10.7).** Not a nicety: this is the mechanism modular RPG-specific features get built as. Design against this three-type taxonomy, not the flat single-event sketch this section originally had. |
| Admin panel | A full Admin Control Panel — first-class product surface, not an afterthought | **Decided — required post-MVP (§02, §10.8),** for both admins and moderators. Distinct from Phase 5's inline moderation actions, which don't need a panel to exist. |
| MyBB migration | A community importer (`nodebb-plugin-import-mybb`) exists but is abandoned — last published roughly a decade ago, pinned to NodeBB 1.12.1 | KuroBB's actual reason to exist as a separate build, not a gap relative to NodeBB — see [kurobb-vs-nodebb.md](./kurobb-vs-nodebb.md) (KRB-004). A custom migration script (§09) was always necessary regardless. |

NodeBB isn't a roadmap KuroBB is behind on — it's a different, larger piece of software
solving a broader problem (themes, widgets, full plugin marketplace) that this barebones
build deliberately doesn't need yet. Its value here is as a check: where NodeBB and this
doc agree (Express, Postgres-as-legitimate, server-side sessions), that's confirmation.
Where they diverge (transport shape, post format), that's a real question, not
automatically a mistake on KuroBB's side — see KRB-004 for the full area-by-area
comparison of what to keep, what to borrow, and what to deliberately leave out.

---

## 14. Deployment

**Decided:** Render (app) + Neon (Postgres), not Render's own managed Postgres or a
self-hosted VPS. Config lives in `render.yaml` at the repo root — it builds from the
existing production `Dockerfile` directly, so there's no separate deploy-specific build
path to maintain.

- **Start free, expect to move off Neon once traffic is real.** Neon's free tier
  (0.5GB/project, scale-to-zero) costs nothing pre-launch. Its paid tier is
  usage-metered (`$/CU-hour` + `$/GB-month`), which is the wrong shape once load is
  steady rather than spiky — at that point, Render's own fixed-price managed Postgres
  (Basic-256mb, ~$6/mo) is cheaper and more predictable than paying Neon per compute-hour
  to keep an instance effectively always-on. Re-evaluate this once there's real,
  sustained traffic — not before.
- **No code changes needed for Neon specifically.** `server/db/client.ts`'s `postgres()`
  call reads `DATABASE_URL` as-is; `postgres.js` parses `sslmode`/`channel_binding`
  query params from a standard connection string on its own (verified against the
  installed driver's source, not assumed). Neon's dashboard-provided connection string
  (pooled or direct — either works here, since Render runs one persistent process with
  one bounded connection pool, not many short-lived serverless invocations) drops in
  directly as `DATABASE_URL`.
- **`SESSION_COOKIE_SECRET` is Render-generated** (`generateValue: true` in
  `render.yaml`), not carried over from local `.env` — a fresh secret per environment,
  consistent with never sharing session-signing material between dev and prod.
- **Compute sizing (0.5 CPU/512MB, Render's Starter tier) is expected to hold at 100
  DAU**, reasoned from this app's actual shape, not guessed: BBCode renders to
  `body_html_cache` at write time (§08), not per page view, so browsing is cheap; and
  argon2 (deliberately CPU-heavy) only runs on register/login, which the 30-day session
  TTL (`SESSION_TTL`) makes infrequent. Watch Render's CPU/memory graphs after launch and
  upgrade only if real usage shows sustained pressure, not preemptively.

---

The original four decisions in §05 are settled, the rendering architecture is decided
(KRB-003, §03), and auth (§07) has been updated to match it. Two things are genuinely
open before Phase 1 of `kurobb-checklist.md` starts: real-time transport shape and
BBCode-vs-Markdown for new posts, both in §05, both informed by NodeBB (§13) and laid
out fully in KRB-004.
