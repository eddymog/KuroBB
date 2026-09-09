# KuroBB — Build Checklist

**Doc:** KRB-002 · Companion to [kurobb-design.md](./kurobb-design.md) (KRB-001, rev 0.5)

Ordered by priority, matching §10's build order. Don't start a phase before the one
above it is checked off — each one is a load-bearing dependency for the next, not just a
suggested sequence. Section references (`§04`, `§05`, …) point back to the design doc.

---

## Phase 0 — Project setup

Not its own step in §10, but everything below needs it first.

- [x] `docker-compose.yml`: `postgres` service always-on, `mysql` behind a `migration` profile (§03)
- [x] `.env.example` committed; `.env` gitignored, holding `DATABASE_URL`, `SESSION_COOKIE_SECRET`, `SESSION_TTL`, `PORT` (§03) — no `CORS_ORIGIN`, there's only one origin now
- [x] Express skeleton with folder-per-feature layout: `forums/`, `auth/`, `posts/`, `users/`, each with `service.ts` / `repository.ts` (§03) — this is where loaders/actions below call into, and where future hook points (Phase 7) will live
- [x] React Router mounted as Express middleware via `@react-router/express` — verified against the current official `node-custom-server` template rather than assumed. **Correction, applied:** the official CLI now scaffolds **React Router v8** (Framework Mode carries forward from v7) — `kurobb-design.md`/KRB-003 updated to say v8 throughout.
- [x] Drizzle Kit configured against the compose Postgres; first empty migration runs clean — verified against a live containerized Postgres: `docker compose up -d postgres && npm run db:migrate` → `migrations applied successfully`. **Port note:** this machine has a native Postgres already bound to `127.0.0.1:5432` (unrelated to this project) — `docker-compose.yml` maps the container to host port `5433` instead of `5432` to avoid silently connecting to the wrong database. If `db:migrate` ever reports a missing role/database that direct `psql` into the container doesn't, check `lsof -nP -iTCP:5432 -sTCP:LISTEN` for exactly this conflict before assuming Drizzle/Docker is broken.
- [x] Centralized error handling + `AppError`, surfaced through loader/action error boundaries (§06) — **implemented as `throwAppError()` + React Router's `data(payload, {status})` + `root.tsx`'s `ErrorBoundary`, not a generic Express `app.use((err, req, res, next) => …)` middleware.** `createRequestHandler` owns the request lifecycle, so Express-level error middleware never sees loader/action errors — this is a real correction to §06's original wording, not just an implementation detail.
- [x] Zod validation in actions, mapped to `VALIDATION_ERROR` (§06, §11) — `server/lib/validation.ts`'s `parseFormData()`
- [x] Confirm one `npm run dev` starts the whole app — no separate frontend dev server process (§03) — verified: server boots, `GET /` returns 200 with the rendered `<h1>KuroBB</h1>` present in the raw HTML (real SSR, not a client-only shell). `npm run build` also verified clean.

---

## Phase 1 — Core schema & browsing (§10.1)

- [x] Drizzle schema: `users`, `forums`, `threads`, `posts`, `sessions` (§04) — no `attachments` table
- [x] `forums.parent_id` adjacency list only — no path column, no closure table (§05)
- [x] `forums.thread_count`, `threads.reply_count`, `threads.last_post_id` as denormalized columns, updated only via atomic `UPDATE ... SET col = col + 1` (§05, §06) — verified via direct DB query after a real reply: `reply_count=1, last_post_id=2`, `forums.thread_count=1`
- [x] In-memory forum tree: load all rows into `Map<id, {parent_id, children[]}>` on boot, refresh on forum create/move (§05) — `server/features/forums/tree.ts`
- [x] `/forums` loader — full tree from the in-memory map, SSR'd (§06)
- [x] `/forums/new` action — creates a forum/category, **intentionally ungated in this phase** (§06) — no auth exists yet to gate it against; Phase 2 adds the permission check on top of this same action, doesn't replace it
- [x] `/forums/:id` loader — paginated thread list (`?page`/`?per_page`), `total`/`total_pages` from `thread_count`, SSR'd
- [x] `/forums/:id/new` action — creates thread, increments `forums.thread_count` atomically. **Note beyond the original item:** thread creation is really "insert thread + its first post" in one transaction (`forums/service.ts`'s `createThread`) — the OP is a real post like any other, not a separate concept, and doesn't increment `reply_count` (only actual replies do).
- [x] `/threads/:id` loader — paginated posts, `total`/`total_pages` from `reply_count`, SSR'd with real per-thread `<title>`/meta tags — verified: `curl`'d raw HTML contains the actual post body and title tag, not a client-only shell
- [x] `/threads/:id` action — reply, increments `reply_count` + sets `last_post_id` atomically, same transaction as the insert (`posts/service.ts`'s `createReply`, via `db.transaction`)
- [x] No seed script, no synthetic data — verified end to end via the real product: created "General Discussion" through `/forums/new`, a thread through `/forums/1/new`, and a reply through `/threads/1` — all through the actual actions, no direct DB inserts, no fake content. The path wasn't awkward.

---

## Phase 2 — Auth & profiles (§10.2)

- [x] `/auth/register` action — Argon2-hash new passwords, tagged uniformly `argon2$…` (not just migrated accounts — every real Argon2 hash, native registrations included). **First registered user on an empty install becomes admin automatically** — no setup wizard exists, so this is the only way anyone gets admin rights on a fresh install; verified via DB (`is_admin=t` on the first account).
- [x] `/auth/login` action — inserts a `sessions` row, sets a single httpOnly cookie holding an opaque session token (not the row id — a random 32-byte token, hashed with SHA-256 before storage, matching `sessions.token_hash`'s intent in §04) (§07) — no JWT, no bearer token
- [x] Session check: `getCurrentUser()` re-queries `sessions`+`users` on every call, no caching — verified by revoking a session (logout) and confirming a subsequent request with the same (now-stale) cookie gets a fresh 401, not a cached 200
- [x] `/auth/logout` action — sets `sessions.revoked_at`, clears the cookie — verified `revoked_at` actually set in Postgres, not just a client-side cookie clear
- [x] **Permission check: deny-overrides-allow merge across a user's groups and a forum's inheritance chain (§05).** Schema added: `groups`, `user_groups`, `forum_permissions` (tri-state `can_view`/`can_post` — `null` = no rule, bootstrapped `Guest`/`Registered` groups created by the app itself on first use, same pattern as the admin bootstrap, not a seed script). `server/features/permissions/service.ts`'s `resolvePermission()` walks the *full* ancestor chain via `getForumAncestorChain()` (§05's tree module), collects rules across every group at every level, and any explicit deny anywhere wins outright — no rule anywhere defaults to allow. `isAdmin` bypasses this entirely rather than needing an "Admins" group. Wired into `/forums/:id` (view), `/forums/:id/new` and `/threads/:id` reply (post). **Verified against real data, not assumed:** a non-admin user posts freely where no rule exists (default open) → an explicit deny on a parent forum blocks posting on a *child* forum with zero rules of its own (the actual inheritance-chain behavior, not just a same-forum check) → the admin bypasses the same deny → an unauthenticated guest posts successfully under the same default-open rule, confirming the Guest-group bootstrap works. No admin UI to manage these rules yet — that's Phase 8's Admin Control Panel; this pass verified the resolution engine directly against the database.
- [x] Gate `/forums/new` (Phase 1) — used the simplest option §06 named: an `isAdmin` boolean on `users`, not a full group/permission system. Gates both the loader (don't show the form) and the action (don't trust the client). Verified: 401 with no cookie, 200 as the admin.
- [x] `/users/:id` loader, `/settings` loader+action — avatar as a plain URL string, no upload path (§06). Public profile strips `passwordHash`/`email`/`isAdmin` before returning — verified end to end: updated a signature via `/settings`, confirmed it appears on `/users/:id`.
- [x] Confirm no bearer token or client-held credential exists anywhere — session id lives only in the httpOnly cookie and the `sessions` table. Verified via `curl -i`: `Set-Cookie` header present, `HttpOnly` flag set, nothing returned in any response body.

---

## Phase 3 — BBCode / rich text (§10.3)

- [x] Install `@bbob/core` + `@bbob/preset-html5` (§08) — **plus two packages this item didn't anticipate, both required, not optional:** `@bbob/html` (the actual HTML renderer — `@bbob/core` alone silently returns an empty string with no render function supplied, confirmed by reading its source) and `sanitize-html` (see the security finding below).
- [x] `body_bbcode` → `body_html_cache` render pipeline, wired into post create (`forums/service.ts`'s `createThread`, `posts/service.ts`'s `createReply`) and edit (`editPost`)
- [~] Pull a random sample of real posts from `mybb-sg`'s dump and run them through the parser — **the dump has no real post content, schema only (0 `INSERT` statements anywhere, verified by grep).** Substituted the closest honest alternative: stress-tested against the *real custom tag definitions* in `tecnicatag.php`/`hidetag.php` (`[personaje]`, `[hp]`, `[ch]`, `[vida=X]`, `[cerrado]`, `[hide]`/`[hide=X]`) plus a genuine bug those files contain (a `[hide=X]...[/susurro]` mismatched-closing-tag regex, likely a leftover from a tag rename) — real code, not real user content. **Testing against the actual production dump is still owed, in Phase 4, once one exists.**
- [x] Confirm nested `[quote]` tags and custom tags don't crash the parser (§12) — zero crashes across every case (nested quotes 2 and 3 levels deep, all seven custom tags above, the `[/susurro]` bug, unclosed `[b]`). **Two real content-behavior findings, not blockers:** (1) `[hide]` spoiler content currently renders as plain *visible* text — spoiler-hiding isn't implemented until Phase 7's plugin layer; (2) any post using the real `[/susurro]` bug pattern will show the literal bracket text `[/susurro]` — cosmetic, not dangerous, and fixable later without re-migrating since `body_bbcode` keeps the real source forever (§08).
- [x] **Security finding, not anticipated by this checklist item, fixed before shipping:** `@bbob/html`'s renderer does zero HTML escaping. Verified two live exploits — a `[script]alert(1)[/script]` "BBCode" tag rendered as a literal, executing `<script>` element, and `[img]`'s known-safe tag handler passes arbitrary attacker-supplied attributes straight through (e.g. an injected `onerror`). Fixed with `sanitize-html` as a mandatory allowlist pass on bbob's output (`server/lib/bbcode.ts`) — tags/attributes/styles/URL schemes explicitly whitelisted to match exactly what the html5 preset can legitimately produce. Verified against a real running post: the literal `[script]...[/script]` text is preserved forever in `body_bbcode` (§08's "never mutate the source" rule, unaffected even for attack payloads) while `body_html_cache` renders it as nothing.
- [x] `/posts/:id/edit` action re-renders `body_html_cache` on edit, never mutates `body_bbcode` destructively (§08) — verified: edited a real post, confirmed both columns updated correctly and `edited_at` was set; verified a different user gets 403 trying to edit someone else's post.

---

## Phase 4 — Migration script (§10.4) — SKIPPED FOR NOW

**I write this one — see the design doc's working agreement. This phase is here for
sequencing, not as work to hand off.** Set aside for now at your request — not dropped,
just out of the current build order. Phases 5+ below proceed without waiting on it,
which is a deliberate exception to this doc's own "nothing in Phase 5 onward starts
before Phases 0–4" rule, made because this specific phase's work was never going to be
mine to do anyway.

- [ ] `mybbLegacyVerify(password, salt, hash)` implemented and unit-tested against real hashes from the dump (§07)
- [ ] Confirm this install's actual MyBB password scheme (`md5(md5(salt)+md5(password))` vs. bcrypt) before relying on the verifier (§07)
- [ ] Import preserves `tid`/`pid`/`uid`/`fid` as primary keys; Postgres sequences bumped above the current max (§09)
- [ ] Explicit decision recorded: whether the `mybb_sg_sg_*` custom RP tables are touched by this pass or left alone entirely (§09, §12)
- [ ] Row-count + checksum verification per table, printed at the end of every run
- [ ] Re-run the script twice against the same dump — confirm no duplicate rows, no errors
- [ ] Upgrade-on-login path tested: a migrated account's first login re-hashes to `argon2$…` and a second login uses the new hash

---

## Phase 5 — Moderation *(post-MVP, required before real public launch)*

- [ ] Lock / pin / move / merge / delete on threads
- [ ] Ban (ties into the `sessions` table — revoke all of a banned user's sessions at once)
- [ ] Report queue (NOT NEEDED, REMOVE)

## Phase 6 — Search *(post-MVP, committed next feature)*

- [ ] Postgres full-text column + GIN index on `posts.body_bbcode` (or a stripped-text variant)
- [ ] `/search` loader, paginated the same way as everything else, SSR'd — the other page (besides `/threads/:id`) where crawlable content actually matters (§06)

## Phase 7 — Plugin/hook ecosystem *(post-MVP, required — not a nicety)*

- [ ] Hook registry modeled on NodeBB's three types — filters (transform content), actions (fire-and-forget side effects), static hooks (blocking, lets a plugin finish async work before execution resumes) (§13) — not a single flat event type
- [ ] Named hook points added to Express services as real needs show up (§03) — not a speculative framework built ahead of any actual plugin
- [ ] Activate/deactivate mechanism, modeled on `mybb-sg`'s real `inc/plugins/*.php` pattern (§12), not its `sg/` layer
- [ ] Confirm Phases 0–6 kept business logic in named service functions rather than inline in loaders/actions — if they didn't, that's the corner this phase will find
- [ ] First real plugin built against this to prove the hook points are actually in the right places — an RPG-specific feature (e.g. a character-sheet module), not a toy example

## Phase 8 — Admin control panel *(post-MVP, required — not a nicety)*

- [~] Admin surface — **built: forum/category structure editing and group/permission management. Not built: migration-run history/report** — blocked on Phase 4 (no migration script exists, so there's no run log to show). `/admin`, `/admin/forums` (list), `/admin/forums/:id/edit` (edit name/description/parent/position; delete only if `threadCount === 0`, returns `409 CONFLICT` otherwise — verified against a real non-empty and a real empty forum), `/admin/groups` (list/create), `/admin/groups/:id` (member add/remove by username, per-forum tri-state view/post rules). This is the real UI for the exact permission rule I set via raw `psql` back in Phase 2 — verified end to end this time through the actual product: created a "Moderator" group, denied `Registered`'s post permission on a forum, confirmed a real non-admin user actually got blocked, all through HTTP actions, zero direct DB writes.
- [ ] **Moderator surface: consolidated home for Phase 5's report queue and mod actions — NOT built.** Blocked on Phase 5, which doesn't exist (no reports table, no ban/lock/pin actions to consolidate). Nothing to build yet, not skipped by oversight.
- [x] **Access-gated — corrected from how this item was originally written.** Not the deny-overrides-allow per-forum model (§05) — that model has no single forum to check an admin action like "edit forum structure" against. Gated by `requireAdmin` (the site-wide `isAdmin` flag, same mechanism already used for `/forums/new`), consistent with how §05/§08 actually separate these two systems. Verified: a non-admin gets `403` on every `/admin/*` route, the admin gets `200`.
- [x] **Real bug found and fixed during this phase, not anticipated by any checklist item:** two admin actions (`admin.forums.$forumId.edit.tsx`, `admin.groups.$groupId.tsx`) need to branch on an `_action` discriminator field before validating the rest of the form — both called `request.formData()` once to check that field, then called `parseFormData(request, schema)` again, which tried to read the same Request body twice (`TypeError: Body is unusable: Body has already been read` — a Request body can only be consumed once). Fixed at the shared helper (`server/lib/validation.ts`'s `parseFormData` now accepts either a `Request` or an already-read `FormData`), not just patched at the two call sites, since this exact pattern — multiple form types on one page — will recur.

## Phase 9 — Account switching *(future)*

- [ ] Cookie holds an array of session ids (one per linked account) plus which is active, not a single id (§07)
- [ ] UI to add an account without logging out of the current one
- [ ] Confirm the `sessions` table needs no schema change to support this (§04, §07) — if it does, that's a signal Phase 2 cut a corner

## Phase 10 — File-upload avatars *(future)*

- [ ] Object storage decision (S3-compatible) — first time this stack needs one
- [ ] Upload endpoint, replacing the Phase 2 URL-string `avatar_url`

---

Nothing in Phase 5 onward starts before Phases 0–3 are fully checked off — Phase 4 is
the sole exception, set aside at your request rather than blocking everything after it.
