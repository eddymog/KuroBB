# KuroBB — Vision & Architecture Ideas

## 1. What this is

A JavaScript full-stack forum platform, NodeBB-shaped, built in two deliberate
phases:

1. **Phase 1 — Generic forum platform.** Categories, threads, posts, users,
   permissions, moderation, notifications, search, theming. Good enough to
   replace phpBB/Discourse/NodeBB for a normal community.
2. **Phase 2 — RPG specialization layer.** XP-from-posting, character sheets,
   multi-character identities, an economy, a battle system — built as
   optional modules on top of Phase 1, not bolted onto it.

The differentiator isn't "another forum." It's that **RP communities today
run on duct tape** — phpBB/Jcink/Proboards forums stapled to a Discord bot,
a Google Sheet for character sheets, and a spreadsheet or hand-rolled plugin
for dice/economy. KuroBB's bet is that if the core forum data model is
designed *from day one* to anticipate characters, stats, and game state,
Phase 2 becomes a plugin story instead of a rewrite. Get that wrong in
Phase 1 and Phase 2 becomes a fork.

## 2. Guiding principles

### 2.1 Extensibility is the product

NodeBB's actual moat was never the forum UI — it was the **hook/plugin
system** (`hooks.fire`, `filter:*`, `action:*`) that let a huge ecosystem of
plugins exist without forking core. KuroBB should copy that lesson
aggressively, because the RPG layer is *itself* just the first (largest)
plugin bundle we'll write.

Concretely, this means Phase 1 must ship with:

- A **hook/event bus** (`emit`/`filter` pattern — filters can mutate data
  and are awaited in order, actions are fire-and-forget side effects) that
  every core action goes through: `filter:post.create`, `action:post.created`,
  `filter:user.profile.fields`, `filter:thread.render`, etc.
- A **plugin package format** (own `package.json` field, e.g.
  `"kurobb": { "hooks": {...}, "adminRoutes": [...] }`) that can register
  routes, admin panel pages, DB migrations, background jobs, and websocket
  events.
- **Schema extensibility on core entities** — User, Thread, Post should all
  support a `metadata: jsonb` / custom-fields bag from day one, so "add a
  character sheet to a post" in Phase 2 doesn't require a migration of the
  `posts` table.
- A **theming system** decoupled from forum logic (like NodeBB's
  persona/harmony split) — RP communities care enormously about branding
  and will not adopt a platform that looks generic.

If this is under-built in Phase 1, every RPG feature in Phase 2 becomes a
core-code change instead of a plugin, and the "open source, self-hostable,
bring your own game rules" pitch collapses.

### 2.2 Minimal core, not a NodeBB clone

KuroBB should be **smaller than NodeBB by design**, not just at launch. The
goal is not to eventually match NodeBB's exhaustive feature surface
(widget/block builder, persona/harmony theme duality, dozens of built-in
gamification and social knobs) — it's to stay deliberately lean and let §2.1's
plugin system carry anything beyond the essentials. A small, well-understood
core is easier to self-host, easier for a non-technical admin to reason
about, easier to keep secure and up to date, and lower cognitive overhead
for anyone writing a plugin against it. Minimalism and extensibility
reinforce each other here: a core kept intentionally small is *forced* to
expose real extension points for everything else, whereas a core that tries
to do everything only grows hooks in the handful of spots someone happened
to need one.

Concretely, core stays limited to: categories/threads/posts, users/personas,
permissions, moderation basics, notifications, search, the plugin/hook
system, and theming — see §5 for the full Phase 1 list. Explicitly **not**
core, even long-term: a drag-and-drop widget/block builder, a built-in
CMS/blog/wiki, a generic points-and-badges gamification system (the RPG
plugin pack's XP/economy is purpose-built for RP forums, not a generic
"engagement" layer), or a sprawling settings panel with hundreds of toggles.
If a feature request doesn't belong to "run a forum," it belongs in a
plugin, not core — that boundary is worth defending deliberately as the
project grows, since feature creep into core is the natural failure mode
for platforms like this.

## 3. Suggested tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js (LTS) | Matches "JS full-stack" goal, huge plugin-author pool |
| Language | TypeScript | Implied throughout by schema validation/typing decisions; stated explicitly here |
| Package manager | pnpm | Native workspace support for the monorepo (§10), strict per-package dependency isolation |
| API | **NestJS (Express platform adapter) for core; plugin-facing API stays plain Express** | See rationale below — real NestJS architecture (DI, guards, pipes) for core, invisible to plugin authors |
| Validation | Zod | Fills the gap Express leaves (no built-in request validation, unlike Fastify); doubles as the runtime validator for character sheet schemas (§6.2) |
| Session/auth | `express-session` + `connect-redis`, `argon2` for password hashing | Implementation of the "own session-based auth" decision, reusing the Redis already in the stack |
| Testing | Vitest | Faster than Jest, native TS/ESM support, no extra config across a multi-package monorepo |
| Lint/format | Biome | Single Rust-based tool for both jobs instead of ESLint + Prettier — much faster, less config to maintain per-package |
| Dev/build tooling | `tsx` (dev), `tsup` (building `packages/db`, `packages/hooks`) | Lightweight TS execution/bundling, no webpack config needed outside the Next.js app |
| Realtime | Socket.IO (Redis adapter) | Live threads, notifications, battle events — see §5 realtime scope |
| Primary DB | PostgreSQL | Relational integrity for users/permissions, `jsonb` for extensible fields, good full-text search, works with Vercel Marketplace (Neon) or self-hosted |
| Schema/migrations | **Drizzle** | Generates plain, readable SQL migrations rather than hiding schema behind a black-box engine (vs. Prisma) — matches §8.1's principle that a self-hosting admin should be able to open and understand their own schema directly |
| Cache/pubsub | Redis (Upstash for hosted, self-hosted for OSS) | Sessions, rate limiting, Socket.IO adapter for multi-instance, leaderboard sorted sets (great fit for XP/economy ranking) |
| Search | Postgres FTS to start; Meilisearch/Typesense later | Avoid ES/OpenSearch operational weight early |
| Frontend | **Next.js (App Router)** | SSR for SEO (forums live and die by Google); Server Components by default, `'use client'` only where the Socket.IO connection/interactivity actually needs it |
| Styling | **Plain CSS + CSS Custom Properties (design tokens) + CSS Modules** | One system for both KuroBB's own UI and end-user forum theming — no build-time class-generation constraint blocking runtime theme installs; see rationale below |
| Admin panel | Separate route tree, same app | Mirrors NodeBB's `/admin` — keep it out of the public bundle |
| Jobs/queues | Vercel Queues, BullMQ (Redis), or a lightweight cron | XP decay, economy ticks, battle resolution, digest emails |
| Auth | Own session-based auth + OAuth providers | Own it — a "download and self-host" platform can't force a third-party auth dependency; support Clerk/Auth0 as optional plugins, not the default |

**API framework: NestJS for core, on the Express platform adapter, with a
framework-agnostic plugin-facing surface.** This project doubles as a
portfolio piece, and demonstrable NestJS proficiency (DI, decorators,
guards/interceptors/pipes, module architecture) is a real, explicit goal —
weighted as a first-class factor here, not just a technical one.

The split resolves the original "one plugin system, not two" concern
(§2.1) rather than reopening it — it just relocates where the boundary
sits:

- **Core** (auth, users/personas, threads/posts, categories, permissions,
  moderation) is built as proper NestJS controllers/services/modules.
  Guards map naturally onto the capability-based permission system
  (`category:X:mod`, §4); a Zod-based `ValidationPipe` keeps the
  already-decided Zod validation (§3) wired through Nest's pipe mechanism;
  `@nestjs/platform-socket.io` + `@WebSocketGateway()` handles the
  realtime layer (§5, §7), Redis adapter attaching the same way
  underneath; `@nestjs/testing` pairs with the Vitest decision for core
  service tests.
- **Plugin-facing API stays plain Express**, deliberately. Nest defaults
  to running on Express under the hood (this is *why* the Express
  platform adapter is required here, not the Fastify one — a Fastify
  adapter would break the "plugins are just raw Express routers" story).
  Nest exposes the underlying Express instance directly
  (`app.getHttpAdapter().getInstance()`); KuroBB's hook/plugin system
  mounts plugin-registered routers/middleware straight onto that instance.
  A plugin author writes `router.get('/foo', (req, res) => {...})` and
  never imports anything from `@nestjs/*` — the "plugin authors only
  learn one system" principle holds, it just now refers to KuroBB's own
  hook API rather than Nest's conventions.
- **Precedent note:** this does diverge from NodeBB's plain-Express
  approach, unlike earlier framework choices in this doc that leaned on
  NodeBB precedent — an acceptable tradeoff here given the explicit
  hireability goal outweighs precedent-matching on this one axis.

**Styling:** plain CSS, not Tailwind. Tailwind (and utility-class tools in
general) compile at build time, which doesn't fit a NodeBB-style *runtime*
theme marketplace — a forum admin installing a new skin shouldn't require
rebuilding and redeploying the app. Instead, one system covers both
KuroBB's own UI and end-user forum theming:

- **CSS Custom Properties as design tokens** (`--color-primary`,
  `--font-body`, `--radius-md`, etc.) hold every themeable value. The
  browser resolves these at render time, so a theme is just a set of token
  values — swapping which set applies (e.g. a `data-theme="..."` attribute
  rendered per tenant) reskins the whole app instantly, no compile step,
  no redeploy. This is the actual mechanism that makes "install a theme
  without a rebuild" possible.
- **CSS Modules** (native to Next.js, zero extra tooling) scope KuroBB's
  own component styles to the file they're defined in, avoiding global
  class-name collisions without needing a naming convention like BEM.
  Modules hold structural/layout CSS; the themeable values inside them are
  written as `var(--token-name)` so look-and-feel stays swappable
  independent of a component's fixed structure.
- A raw **"custom CSS" escape hatch per forum** on top of tokens, for
  admins who want more control than the token set exposes — same pattern
  NodeBB and most themable SaaS platforms use.

This also removes the earlier split (Tailwind for app chrome, tokens for
forum theming) in favor of one consistent system everywhere, which is
simpler to maintain and easier for plugin/theme authors to learn — there's
only one styling approach in the codebase, not two.

**Deployment note:** a forum needs long-lived realtime connections and
background job workers, which don't fit purely serverless/edge functions.
For the self-hosted OSS path, a single Docker Compose (app + Postgres +
Redis) is the right target — this is what NodeBB does and what forum admins
expect. For a future hosted SaaS, that same container can run on Fluid
Compute–backed Vercel Functions for the HTTP/API surface with a dedicated
always-on service (Fly.io/Railway/small VM) for the WebSocket/battle-tick
workers — don't force everything through one deployment model this early.

## 4. Data model foundations (design now, even though Phase 1 is generic)

The single most important non-obvious decision: **separate `User` (login
identity) from `Persona`/`Character` (posting identity)**, as a genuine
one-to-many relationship from day one — not a fake `1:1` constraint we
loosen later. There's no meaningful complexity saved by artificially
capping it at one persona in Phase 1: the schema shape (FK from `Persona`
to `User`) is identical either way, so there's nothing to migrate later if
we just build the real relationship now.

What *does* stay configurable per forum is `max_characters_per_user`
(default `1`). A plain generic forum sets it to `1` and never shows
persona-switching UI at all — a user's one persona just *is* their
profile, so the extra concept stays invisible to that audience. An RP
forum admin raises the cap (or sets it unlimited), and the Phase 2 plugin
pack turns on "add character" / "switch active character" UI. Same schema,
same API, config + UI toggle is the only difference between "generic
forum" and "RP forum" for this feature — which is exactly the plugin-not-
fork outcome §2 is aiming for.

```
User (auth, email, credentials, global role, ban status)
  └── Persona[] (display name, avatar, bio, "belongs to" User)
        └── Post.author_id → Persona.id   (not User.id)
```

When `max_characters_per_user > 1`, the session tracks an
**`active_persona_id`** — "who am I right now" for a User with multiple
characters, set via the switcher UI and defaulting to the user's only
persona when the cap is `1`. This single piece of session state is reused
everywhere identity display matters: default post authorship, and the
site-wide "who's online" list (§5) — one active-persona concept, not a
separate one per feature.

Other forward-looking schema notes:
- `posts.metadata jsonb` — houses character-sheet snapshots, dice-roll
  results, IC/OOC flag, battle-log references, without new tables per
  feature.
- `threads.type` enum, extensible via plugin registry — `discussion`,
  `in-character`, `battle-log`, etc., each can have different render rules.
- Permissions as a capability system (`category:X:post`, `category:X:mod`)
  rather than fixed roles, so "Game Master" can be a real permission bundle
  later, not a hack.

## 5. Phase 1 — generic forum feature set

Table-stakes, roughly NodeBB/Discourse parity:
- Categories/sub-categories, threads, nested or flat replies
- **BBCode as the only post editor mode** — no secondary Markdown mode.
  Matches the Jcink/Proboards-refugee audience this platform targets, and
  keeps with §2.2's minimalism principle: one editor syntax to build,
  document, and sanitize, not two. Compiles to sanitized HTML through a
  single renderer that plugins (dice roller, character-sheet embeds) hook
  into.
- User profiles, avatars, signatures
- Roles & permissions per category
- Moderation queue, reports, bans, IP/device tracking for alt detection
  (ironic given Phase 2 *wants* alts — moderation needs to distinguish
  "sanctioned character" alts from ban-evasion alts, see §6.3)
- Full-text search
- Private messaging
- Plugin + theme marketplace/registry (even a simple one) from day one
- REST + WebSocket API, documented, since "bring your own game rules"
  implies third-party bots/tools will integrate against it
- i18n scaffolding (RP communities are heavily international)
- **Responsive, mobile-first UI** — not a native app (see below), a
  properly responsive layout built into the base theme and admin panel
  from the start, since retrofitting responsiveness onto a desktop-first
  admin panel is one of the most common forum-software regrets

**Notifications & realtime scope for v1:** scope v1 to three things —
notification push, live thread updates, and a site-wide "who's online"
list — while still deferring the genuinely expensive presence features
(per-thread live viewer lists, typing indicators).

1. **Push notifications** (new reply, PM, mention) over the same
   Socket.IO connection instead of interval polling — this is what makes
   the app feel alive without needing room/presence machinery.
2. **Live updates within an open thread** — if you're reading a thread and
   someone replies, it appears without a refresh (subscribe to a
   per-thread room, unsubscribe on navigate-away).
3. **Site-wide "who's online"** (shown on the index, classic phpBB/NodeBB-
   style widget) — deliberately implemented as a **cheap TTL/heartbeat
   mechanism, not Socket.IO room tracking**: each authenticated request
   (or a lightweight periodic client heartbeat) refreshes an entry in a
   per-tenant Redis sorted set (`tenant:{id}:online`, score = timestamp);
   the index page just reads back everyone active in the last N minutes
   (configurable, default ~10–15). This avoids connection-lifecycle
   bookkeeping entirely (no join/leave events, no reconciling state after
   a server restart or a dropped socket) and works the same whether the
   user is actively connected via Socket.IO or just browsing page to page
   — "online" here means "recently active," not "currently has a live
   connection," which is exactly what this widget has always meant on
   forum software.

   Shows the **active Persona**, not the underlying User account — since
   users switch characters while browsing, the online list should reflect
   whoever they're currently "wearing," matching how the rest of the
   forum already displays them. This requires session-level state: which
   persona is currently active (defaults to the only one when
   `max_characters_per_user = 1`; explicitly selected via the character
   switcher otherwise, §4) — the same active-persona value that already
   determines default post authorship, now reused here too, so there's
   only one "who am I right now" concept in the system rather than a
   separate one per feature. The member written into the Redis sorted set
   is the **persona ID**, keyed by tenant.

   A nice side effect of the TTL design: character switching needs no
   explicit "leave" event. Once a user switches personas, subsequent
   heartbeats refresh the *new* persona's entry; the old persona's entry
   simply ages out of the last-N-minutes window on its own. Staff-facing
   moderation views can still resolve any listed persona back to its
   underlying User for ban-evasion checks (§6.3) — the privacy boundary
   is public-facing only. A guest/anonymous count can ride the same
   mechanism keyed off a session cookie, as a later nice-to-have, not
   required for v1.

All three reuse infrastructure already committed to (Socket.IO + Redis for
1 and 2, plain Redis for 3), and 1/2 are directly reused by Phase 2's
battle system (a turn notification is the same primitive as a reply
notification). What's still deferred is specifically **per-thread live
viewer lists and typing indicators** — those need actual connection/room
tracking (who is looking at *this* thread *right now*), which is a
materially different and more expensive problem than a coarse "active in
the last 15 minutes" site-wide list. Those can become a later plugin if a
community actually wants them — don't build them speculatively.

**Mobile:** ship as a responsive web app with a PWA manifest + service
worker (installable, "add to home screen," Web Push reusing the same push
infra as in-browser notifications) rather than a native app. A native
React Native app doesn't fit the "download and self-host, bring your own
branding" story — you can't realistically ship a white-labeled native app
per small self-hosted tenant, and the RP-forum audience is already
browser/Discord-native rather than app-native. Revisit native only if a
future hosted flagship product has strong demand for it.

## 6. Phase 2 — RPG specialization ideas

### 6.1 Experience from posting
- Two configurable XP modes per forum, admin picks one (or blends them):
  **per-post** (flat XP for each post made) and **per-character/length**
  (XP scaled by how much was written — e.g. X XP per N characters). No
  staff approval gate and no cooldown between XP-earning posts — keep this
  system simple and trust the admin's own configuration (rate/curve
  tuning) rather than building anti-spam machinery into core. If a
  specific community needs stricter anti-abuse controls, that's a natural
  fit for a plugin on top of the XP hook, not a default everyone pays for.
- XP curve and rewards fully configurable per forum instance (level
  thresholds, what a level *unlocks* — title, stat points, cosmetic badge).
- XP accrues to the **Persona**, not the User — a character earns their own
  experience, matching how RP communities actually think about progression.
- Leaderboards via Redis sorted sets (cheap, fast, matches the cache layer
  already in the stack).

### 6.2 Character sheets
- Admin-defined **schema builder** per forum/game-system (field types:
  text, number, stat-with-modifier, dropdown, image, computed/derived
  field) — this is what makes KuroBB "generic" rather than "D&D-only."
  Store as JSON Schema so both a form renderer and validation reuse it.
  This is the same extensibility mechanism NodeBB uses for custom user
  profile fields — reuse it, don't reinvent it.
  - Ship 2–3 starter templates (freeform narrative sheet, D20-style stat
    block, anime-power-system stat block) so admins aren't starting blank.
- Sheet versioning (character grows, sheet changes over time — keep
  history, not just current state).
- Sheets attach to a **Persona**, and posts can optionally embed a live or
  frozen snapshot of relevant stats (for battle logs especially).

### 6.3 Multi-accounts (as a feature, not a violation)
- This is the biggest structural break from normal forum software, where
  multi-accounting is bannable. Solve it by making it explicit:
  - One `User` (billing/auth/ban identity) → many `Persona` (characters),
    already modeled in §4.
  - Admin/mod view always resolves Persona → underlying User, so real ban
    evasion is still fully visible to staff even though public-facing pages
    show only the character.
  - Per-forum cap on personas (configurable), and optional "character
    approval" workflow before a new persona can post in-character.

### 6.4 Economy
- Virtual currency ledger per Persona (and optionally per User for
  account-wide currency), with an explicit, immutable transaction log —
  treat it like a mini ledger/accounting system, not a mutable balance
  column, so disputes and exploits are auditable.
- Faucets: XP milestones, event rewards, daily login, admin grants.
- Sinks: shop (cosmetic items, sheet perks, battle consumables), auction
  house between users, sinks are what prevent runaway inflation — bake
  sink design into the admin tools, don't leave it to chance.
- Shop/inventory as its own plugin module so non-RPG forums can disable it
  entirely.

### 6.5 Battle system
- Start with a **deterministic, dice-roll-resolved combat engine**
  (attacker/defender stat comparison + RNG, D20-style modifiers) since
  that's the most common RP-forum mental model and the easiest to make
  provably fair/auditable.
- Battle actions are literally forum posts (many RP communities already
  narrate combat as alternating IC posts) — a battle is a specialized
  `thread.type = 'battle-log'` with a structured action log alongside the
  narrative text.
- Turn timers, PvP challenges, PvE "encounters" postable by GMs, cooldowns
  tied to the economy/XP systems so combat isn't a separate silo.
- Expose combat resolution as a pluggable strategy (interface, not a single
  hardcoded formula) — different communities run different systems
  (freeform, D20, anime power scaling), and the battle *engine* should be
  swappable the same way the character sheet schema is.
- **Math model: client-computed, server-verified** (not full server-
  authoritative) for both battle resolution and economy transactions —
  deferred as a detailed design until Phase 2 implementation, but noted
  now because it constrains the engine interface above: whatever resolves
  a combat/economy action needs to be a pure, deterministic function
  (same inputs → same outputs) so the server can cheaply replay and check
  a client's claimed result rather than doing the full computation itself.

### 6.6 Cross-cutting RP features worth planning for early
- **IC/OOC distinction** on every post (in-character vs out-of-character
  chatter) — small feature, huge UX impact for this audience, cheap to add
  to the `posts.metadata` bag in §4.
- **Dice roller** as a first-class chat/post command (`/roll 2d6+3`),
  reusable by the battle engine.
- **Timeline/canon tools** — many RP communities track in-universe
  chronology separate from real-world post order; low priority but worth
  a data-model note now (a thread/post `in_universe_date` field costs
  nothing to add early, a lot to retrofit).

## 7. Multi-tenant hosting architecture

**Database-per-tenant, shared app/compute layer** — one KuroBB instance
(app fleet) can serve multiple forums, but each forum gets its own
dedicated Postgres database, not a shared schema with row-level isolation.
This revises the earlier row-level-multi-tenancy plan: row-level sharing
optimizes for hosting density (many small tenants as cheaply as possible),
but that optimization actively works against §8.1's autonomy principle —
you can't hand a tenant real, direct DB credentials to "their" data if
that data lives in the same database as every other tenant's. Given
autonomy is the stated priority (and the actual near-term target is two
forums, not hundreds), database-per-tenant is the more honest fit:

- **One Postgres database per forum.** A tenant's entire dataset is a
  single database — trivial to back up, export, hand over, or grant
  direct SQL credentials to, and a cross-tenant data leak becomes
  structurally impossible (a connection to tenant A's database simply
  cannot see tenant B's rows) rather than something enforced by app-level
  discipline or RLS policy. This also makes **per-tenant plugin schemas**
  clean — a plugin's migrations only ever run against the databases of
  tenants that actually enabled it, no conditional logic needed to keep
  one shared schema consistent across tenants with different plugins
  installed.
- **Shared app fleet, tenant-aware routing.** The Node/Express layer
  resolves each incoming request's domain to a tenant, then picks that
  tenant's DB connection — the compute layer stays multi-tenant even
  though the data layer doesn't. A **serverless/branching Postgres
  provider (e.g. Neon, already noted in §3)** is a strong fit for the
  hosted-SaaS tier specifically, since spinning up many lightweight
  databases and connecting to them without holding a traditional
  always-on connection pool per tenant is exactly what that class of
  Postgres product is built for — worth designing the DB-provisioning
  layer around that rather than assuming classic long-lived connection
  pools per tenant.
- **Per-tenant migrations.** Applying a migration means looping over each
  tenant's database, not running it once — more moving parts than a
  single shared-schema migration, but the direct cost of the isolation
  model, and the same shape NodeBB/WordPress multisite-with-separate-DBs
  already use.
- **Redis** can stay shared, namespaced by tenant-prefixed keys — it's
  ephemeral cache/session/pubsub infrastructure, not the tenant's actual
  data, so sharing it doesn't conflict with the autonomy principle.
- **Socket.IO** rooms/namespaces scoped per tenant, same shared Socket.IO
  deployment backed by the shared Redis adapter.
- **File/media uploads** (avatars, character art) go to blob storage
  under tenant-prefixed paths for the hosted SaaS; for self-hosted
  instances, per §8.1's extended filesystem autonomy, these can live on
  the admin's own filesystem/volume if they prefer.
- **Custom domains per tenant** via a routing/reverse-proxy layer in
  front of the shared app fleet, same as before.
- **Keep the self-hosted OSS build and the hosted SaaS on one codebase.**
  Self-hosting one forum is simply the one-tenant case of the same
  architecture — one app instance, one database, tenant-resolution logic
  that trivially resolves to the only tenant that exists.

## 8. Open source & hosting strategy

- License the core under a permissive-but-protective license (AGPL or a
  source-available license with a SaaS carve-out) if a hosted offering is
  the long-term business — decide this *before* external contributors show
  up, changing license later is painful.
- **Minimal, in-house plugin registry, built early** — not a full
  marketplace with payments/reviews on day one, just a lightweight index
  (name, repo link, compatible core version) that `kurobb plugin install`
  can query, reserving the `kurobb-plugin-*` package namespace from the
  start. Grow it into something richer (search, ratings, a real
  marketplace UI) once there's enough plugin volume to justify it — same
  path WordPress and NodeBB took, just starting the index earlier so
  plugin authors have somewhere to publish from day one rather than
  scattering across random GitHub repos.

### 8.1 Self-hosting philosophy: full data/backend autonomy, protected skeleton only

This is a deliberate departure from NodeBB. NodeBB technically allows DB
access, but funnels almost everything through its own API/ORM layer —
self-hosters are expected to interact with NodeBB *through* NodeBB, not
with their own data directly. KuroBB should do the opposite: **the admin
owns their data and backend, full stop.** Direct SQL access, custom
reports/views against the Postgres schema, writing standalone scripts that
hit the database directly, even editing config or backend code beyond
plugins — all explicitly supported use cases, not things the platform
tries to prevent or discourage.

The same principle extends to the **filesystem**, not just the database:
on a self-hosted instance, the admin should have real access to the
server/container their forum runs on — uploads, custom plugin files,
config, logs, static assets — not be sandboxed away from their own
deployment the way a typical managed SaaS locks users out of the
underlying machine.

What stays protected is a narrow **"skeleton"**: the plugin/hook loader
contract, the core migrations engine, auth/session internals, and the
core application source itself — the parts that need to stay stable (and
un-tampered-with) for upgrades, and for plugins written against the hook
system, to keep working. Everything else — content, configuration, custom
SQL, uploaded files, bespoke scripts and integrations — is the admin's to
touch freely. This is also *why* Postgres with a plain, documented
relational schema (§3) was chosen over a NoSQL/blob-only store: an admin
who knows SQL should be able to open a client and just look at their own
data, the same way a MyBB or phpBB admin could always poke around a MySQL
database directly.

One concrete engineering consequence worth flagging now: because direct
schema access is expected behavior rather than an edge case, core
migrations need to be written defensively (idempotent, tolerant of
manual schema drift where reasonably possible) rather than assuming the
DB only ever changes through KuroBB's own migration runner.

### 8.2 Self-hosting installation experience

Target audience is explicitly **non-technical forum admins** — the same
people currently running MyBB, phpBB, or Jcink boards, not developers.
Worth being honest about a real constraint here: unlike a PHP forum, a
Node.js + Postgres + Redis stack can't run on classic zero-terminal shared
hosting (no cPanel "upload via FTP and go" equivalent exists for this
stack). Ranked by how the platform should actually point people, ideal
first:

1. **One-click "Deploy" to a PaaS provider is the ideal self-hosted path**
   — Railway, Render, or DigitalOcean App Platform, provisioning
   Postgres/Redis/the app from a single button with no terminal touched.
   This is the option worth polishing hardest, since it's the closest
   thing to "click a button and have a forum" for a non-technical admin.
   One caveat worth being explicit about: this only works for PaaS
   providers that give a real, persistent container with volume/shell
   access — which is what §8.1's filesystem-autonomy goal actually needs.
   Railway and Render fit that (container-based, persistent volumes,
   in-browser shell). A pure serverless-functions platform doesn't — it's
   ephemeral and stateless per-invocation by design, which is exactly
   wrong for "the admin can touch their own filesystem" plus the
   long-lived Socket.IO connections and background workers already noted
   in §3's deployment note. So: Railway/Render/DO App Platform for the
   self-host one-click target, not a serverless-functions platform —
   those stay a better fit for the hosted SaaS's stateless HTTP surface
   later, per §3.
2. **A first-run setup wizard**, in the spirit of the classic phpBB/MyBB/
   WordPress installer, is the common UI layer regardless of where step 1
   deploys to: DB connection, site name, admin account creation — no
   config files hand-edited, no terminal commands typed. This is the
   "skeleton" install experience.
3. **A heavily automated one-script VPS installer** (DigitalOcean/Vultr/
   Hetzner "$5/mo" tier) as a fallback for admins who'd rather run their
   own cheap VPS than use a PaaS provider's pricing — same wizard, just a
   different underlying host.
4. The eventual **KuroBB-hosted SaaS** (§9 roadmap step 5) is the true
   ideal *end state* beyond self-hosting entirely — zero infrastructure
   decisions at all for anyone who just wants a forum, not even a
   one-click deploy. Self-hosting (however easy step 1 makes it) will
   always mean *some* infrastructure choice; hosting removes that
   question completely.

This isn't a distant concern: the plan is to self-host two real forums
(migrated from MyBB) from the very start, which makes the self-host
install/upgrade experience a **Phase 1 requirement in practice**, not a
polish item deferred to whenever external users show up. Dogfooding on
real communities early is also what will actually validate whether the
autonomy philosophy in §8.1 holds up outside of theory.

## 9. Rough roadmap

1. **Foundation**: hook/plugin architecture, auth, User/Persona split,
   Postgres schema with extensibility hooks, basic categories/threads/posts.
2. **Forum parity**: permissions, moderation, notifications, search,
   theming, admin panel, **and the self-host setup wizard (§8.2)** — ship
   this as a usable OSS forum on its own, good enough to actually migrate
   the two MyBB forums onto.
3. **RPG plugin pack v1**: XP + character sheets + IC/OOC, as the first
   real test of the plugin architecture built in step 1.
4. **RPG plugin pack v2**: economy + battle system, building on personas
   and sheets from step 3.
5. **Hosting platform**: multi-tenant provisioning, billing, managed
   updates — only once the self-hosted product is validated by real
   communities.

## 10. Decisions log

Resolved so far (superseding earlier "open question" framing):

- **API framework:** NestJS (Express platform adapter) for core;
  plugin-facing API stays plain Express, mounted onto Nest's underlying
  Express instance — chosen partly for hireability (real NestJS
  architecture in core), while keeping plugin authors isolated from Nest
  entirely (§3).
- **Frontend:** Next.js, App Router (§3).
- **Styling:** plain CSS + CSS Custom Properties (design tokens) + CSS
  Modules — one system for both KuroBB's own UI and end-user forum
  theming, no Tailwind/utility-class build step (§3).
- **Realtime transport:** Socket.IO with Redis adapter (§3).
- **User↔Persona:** real one-to-many from day one, gated by a per-forum
  `max_characters_per_user` config rather than a schema constraint (§4).
- **Multi-tenant hosting:** shared app fleet, but **database-per-tenant**
  — each forum gets its own dedicated Postgres database, not row-level
  isolation in a shared one. Chosen over row-level sharing because it
  directly serves the self-hosting autonomy principle (§8.1): a tenant's
  data is a genuinely separable, exportable, credential-able unit (§7).
- **Default editor:** BBCode only, no Markdown mode (§5).
- **Realtime v1 scope:** notification push + live-updating open threads +
  a site-wide "who's online" list keyed on active **Persona** (cheap Redis
  TTL/heartbeat, not Socket.IO room tracking); per-thread live viewer
  lists and typing indicators still deferred (§5).
- **Mobile:** responsive PWA, no native app planned (§5).
- **Battle/economy math:** client-computed, server-verified — detailed
  anti-cheat/verification design deferred to Phase 2 implementation, but
  the engine interface (§6.5) is being designed as a pure/deterministic
  function now so verification is possible later without a rewrite.
- **XP from posting:** two configurable modes (per-post flat, or
  per-character/length-scaled), admin's choice per forum; no staff
  approval gate, no cooldown — kept deliberately simple (§6.1).
- **Core philosophy: minimal core, not NodeBB feature parity** — small,
  well-understood core plus the plugin system carries the rest; explicit
  non-goals listed (widget builder, generic gamification layer, sprawling
  settings panel) (§2.2).
- **Plugin registry:** minimal in-house index built early, not deferred to
  "someday," not a full marketplace on day one (§8).
- **Self-hosting philosophy:** admins get full autonomy over their data
  *and filesystem* (direct DB/SQL access and server/container filesystem
  access both explicitly supported); only the plugin/hook contract,
  migrations engine, auth internals, and core app source are protected
  "skeleton" (§8.1).
- **Self-hosting install path, ranked ideal-first:** one-click PaaS deploy
  (Railway/Render/DigitalOcean App Platform — container-based providers
  with persistent volumes and shell access, not serverless-functions
  platforms) as the primary target; a first-run setup wizard as the
  common install UI regardless of host; a VPS + install-script path as a
  fallback for the DIY/cost-conscious; the eventual KuroBB-hosted SaaS as
  the true zero-infrastructure ideal beyond self-hosting entirely (§8.2).
- **License: AGPL-3.0.** Real open source (OSI-approved), closes the
  "modify and host without releasing changes" loophole plain GPL leaves
  open, and fits the self-hosting-autonomy ethos (§8.1) better than a
  source-available/no-competing-host license — accepted the tradeoff that
  it doesn't prevent someone reselling hosting of *unmodified* KuroBB,
  since that's a survivable risk for a niche product rather than the
  cloud-provider-scale threat licenses like BSL/Elastic were built to
  stop. `LICENSE` (AGPL-3.0 text) is in the repo root. Get a CLA in place
  before accepting external contributions if relicensing flexibility
  needs to stay open later.
- **Schema/migrations: Drizzle**, not Prisma or raw hand-written SQL —
  generates plain, readable SQL migrations rather than hiding them behind
  a black-box engine, which directly matches §8.1's "an admin who knows
  SQL should be able to open a client and understand their own schema"
  principle. Add to §3 tech stack.
- **Repo shape: small monorepo**, not a single app — hard package
  boundaries matter here because the plugin/hook system (§2.1) *is* the
  product surface plugin authors code against, and a single app tends to
  blur the Express/Next.js runtime split rather than enforce it. Rough
  shape:
  ```
  apps/
    web/          (Next.js frontend)
    api/          (Express server)
  packages/
    db/           (Drizzle schema + migrations, shared types)
    hooks/        (the plugin/hook system core)
  ```
  npm/pnpm workspaces — no Turborepo/Nx needed at this size.

## 11. Open questions still worth deciding early

- Anti-cheat verification design for client-computed battle/economy math
  — deferred, but should be settled before Phase 2 economy/battle ship,
  not discovered after launch.
  in chat.
