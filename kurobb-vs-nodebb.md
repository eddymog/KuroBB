# KuroBB vs. NodeBB — Feature & Architecture Comparison

**Doc:** KRB-004 · Companion to [kurobb-design.md](./kurobb-design.md) (KRB-001, rev 0.4),
[kurobb-checklist.md](./kurobb-checklist.md) (KRB-002),
[kurobb-frontend-alternatives.md](./kurobb-frontend-alternatives.md) (KRB-003)

KuroBB is, at its core, a minimal clone of NodeBB — a modern Node.js forum, built custom
rather than adopted, with one capability NodeBB doesn't have: migrating a real MyBB
installation. This isn't a question of switching platforms; it's a straight comparison,
area by area, of what's good to keep in KuroBB's current design, what's worth borrowing
from NodeBB's more mature answer, and what's fine to deliberately leave out.

---

## Area-by-area comparison

| Area | NodeBB | KuroBB | Verdict |
|---|---|---|---|
| Core backend | Node.js + Express, domain modules (User, Topics, Posts, Categories, Messaging, Plugins, Privileges) | Node.js + Express, folder-per-feature (`auth/`, `threads/`, `posts/`, `forums/`) | **Keep.** Same shape under different names — NodeBB validates the pattern rather than challenging it. |
| Database | Pluggable Redis / MongoDB / PostgreSQL behind one identical internal API | PostgreSQL only, Drizzle typed queries, raw SQL where it matters (§03) | **Keep KuroBB's.** No reason to build a multi-backend abstraction for a single-operator forum — it buys portability KuroBB will never use, at the cost of not fully exploiting Postgres-specific features (real FKs, GIN indexes, cross-table transactions). |
| Real-time | Socket.IO as the *primary* transport after first SSR load, not just push | Socket.IO planned, but as a bolt-on for live notifications only — §05's open question | **Leave NodeBB's version for now.** Socket-as-primary-transport roughly doubles §06's surface area (every loader/action needs a socket-message equivalent) — more commitment than a barebones build needs. See the resolution below. |
| Sessions | Server-side, DB-backed | Server-side, DB-backed (§07) | **Keep** — independent confirmation, not a change. |
| Post format | Markdown by default | BBCode, matching migrated content (§08) | **Leave Markdown for now.** Migrated users already know BBCode from `mybb-sg`; forcing new markup on real people is a real UX cost with no offsetting benefit yet. See the resolution below. |
| Permissions | A dedicated "Privileges" module | Explicit permission-resolution service: deny-overrides-allow, resolve-on-read (§05) | **Keep.** NodeBB validates treating this as its own first-class concern rather than scattered ad hoc checks. NodeBB's exact merge semantics weren't verified this session — worth confirming before assuming either agreement or conflict, rather than guessing. |
| Plugins / hooks | Three hook types — **filters** (transform content in flight), **actions** (fire-and-forget side effects), **static hooks** (blocking — a plugin finishes async work before execution resumes) | A flat `hooks.run(name, payload)` sketch, not yet built (Phase 9) | **Borrow from NodeBB.** When Phase 9 is actually built, use the three-type taxonomy instead of one generic event type — it's a genuinely better-designed model, not just a different one. |
| Data model | Document-shaped internally (Topics/Posts/Categories as objects), even on the Postgres backend | Fully relational, designed for this schema specifically (§04) | **Keep KuroBB's.** A from-scratch relational schema, not a document model adapted onto Postgres. |
| Admin panel | A full Admin Control Panel — first-class product surface | Required post-MVP (§02, §10.8), for both admins and moderators — was flagged here, now decided in `kurobb-design.md` | **Borrow the shape from NodeBB** — one dedicated surface, not scattered per-thread controls, distinct from Phase 5's inline moderation actions. |
| Themes / widgets / plugin marketplace | Full ecosystem | Explicitly out of scope (§02) | **Leave out.** Doesn't match a ~200-forum, 100-DAU install — the same unearned-infrastructure call already made against Redis and Elasticsearch elsewhere in this doc. |
| Private messaging | Built in (Messaging module) | Deferred (§02) — "common dead weight on real MyBB installs" | **Leave out for MVP** — consistent with the usage-data-driven scope cuts already decided. |
| MyBB migration | A community importer plugin exists but is abandoned — last published roughly a decade ago, pinned to NodeBB 1.12.1 | First-class, designed-for-this concern (§09, §12) | **Keep** — this is KuroBB's actual reason to exist as a separate build, not a gap relative to NodeBB. |

---

## The admin-panel gap — resolved

NodeBB treats its Admin Control Panel as core product surface, not an afterthought.
This was flagged here as a real gap in KuroBB's original design — moderation actions
existed (Phase 5) but no general surface for editing forum structure, managing
groups/permissions, or reviewing what the migration script actually did. It's since been
decided, not left open: a dedicated admin panel is a firm requirement, post-MVP, for
both admins and moderators (`kurobb-design.md` §02, §10.8).

---

## General pros/cons: staying minimal vs. NodeBB's full platform

**Pros of staying minimal (KuroBB's actual path)**
- Every line is understood and owned — no reconciling application logic with an abstraction layer built for backends (Redis, MongoDB) KuroBB will never run.
- Scope matches real usage (§02's 20%) instead of carrying years of accumulated NodeBB features that a ~200-forum, 100-DAU install won't touch.
- The one thing that actually matters here — migrating a specific, real MyBB install — gets first-class design attention (§09, §12) instead of being bolted onto a generic, long-abandoned importer plugin.

**Cons of staying minimal**
- Everything NodeBB gets "for free" — real-time infrastructure, a plugin ecosystem, an admin panel, years of production hardening — is calendar time KuroBB has to spend instead.
- No community of other operators, and no existing plugins to reach for when something's missing.
- Higher chance of shipping a subtle bug in something NodeBB's production traffic already found and fixed years ago — mitigated, not eliminated, by grounding decisions against both `mybb-sg` (§12) and NodeBB (§13) as references instead of building in a vacuum.

---

## Two items from this comparison, resolved in `kurobb-design.md` §05

### Real-time transport shape

Bolt-on Socket.IO for live push (new-reply notifications, an unread badge updating
without a refresh, presence) — not NodeBB's socket-as-primary-transport. It ships real
value fast without rearchitecting §06's request lifecycle, and it's not a dead end: the
same Socket.IO connection and per-thread rooms it needs are exactly what a future move
toward NodeBB's model would build on, not something to discard. Worth reconsidering only
if live, simultaneous RP scenes — several people replying in the same thread in real
time — turn out to be a core use case for this specific community.

### Post format

BBCode only, for now — no change from §08. The migrated community already knows it;
Markdown would be a real adoption-friction cost on real users for no concrete benefit
yet, which cuts against `claude.md`'s "users first, portfolio second" principle
directly. If Markdown is wanted later, add it as a second format tagged per post (same
pattern as `password_hash`'s `mybb$`/`argon2$` tagging in §04) rather than replacing
BBCode outright.

---

## Summary

| Area | Keep KuroBB's way | Borrow from NodeBB | Deliberately left out |
|---|---|---|---|
| Backend structure | ✅ | | |
| Database | ✅ (Postgres-only) | | |
| Sessions | ✅ | | |
| Data model | ✅ (relational) | | |
| MyBB migration | ✅ | | |
| Plugin/hook ecosystem | | ✅ (three hook types — required post-MVP, not a nicety) | |
| Admin control panel | | ✅ (one dedicated surface — required post-MVP, not a nicety) | |
| Real-time transport | | | ✅ (bolt-on, not primary) |
| Post format | | | ✅ (BBCode only, for now) |
| Themes / calendar / reputation | | | ✅ |
| Plugin marketplace | | | ✅ |
| Private messaging | | | ✅ |
