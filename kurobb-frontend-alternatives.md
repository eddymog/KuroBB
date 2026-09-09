# KuroBB — Frontend/Rendering Architecture Alternatives

**Doc:** KRB-003 · Companion to [kurobb-design.md](./kurobb-design.md) (KRB-001) and
[kurobb-checklist.md](./kurobb-checklist.md) (KRB-002)

**Decided: Option 4.** Folded into `kurobb-design.md` rev 0.3 (§03, §04, §06, §07) and
`kurobb-checklist.md`. This document stays as the record of what was considered and why
— not a live decision anymore, but the reasoning below is still the reference for it.

---

## Why this document exists

`kurobb-design.md` originally specified a plain Vite + React SPA calling a separate
Express API, with no server-side rendering. That was fine when this was a from-scratch
build with no live-traffic concerns. It stopped being fine once a real requirement
surfaced: **this is a ~2,000-posts/month, 100-DAU RPG forum whose growth channel is
Google search** — the same reason the *original* pre-pivot version of this project cared
about preserving MyBB's indexed URLs. A client-only SPA renders an empty shell to a
crawler first and fills it in with JavaScript after; that's a real indexing risk for
exactly the pages that matter — individual threads, character names, technique names.

## Requirements this has to satisfy

- Crawlable HTML per forum/thread page — real `<title>` and meta/OG tags per thread, not a generic shell
- Good Core Web Vitals — page weight/speed feed into search ranking too, not just crawlability
- Scale-appropriate — 100 DAU / ~2k posts a month doesn't justify infrastructure that only pays off at a much bigger size
- Preserve the already-designed Express backend where reasonable — permission model (§05), atomic counters (§05), `sessions` table (§04), `bbob` pipeline (§08) — rebuilding those has a real cost
- Stays maintainable by one person / a small team

---

## The alternatives

### 1. Status quo — Vite SPA + Express API, no SSR

What `kurobb-design.md` currently says. No server-rendered HTML at all; the browser gets
an empty `<div id="root">` and fills it in client-side.

- **SEO:** Poor for this use case. Modern Googlebot can execute JavaScript, but JS-rendered pages queue for a separate, slower rendering pass and indexing can lag by days to weeks — a real cost for a growth channel that's explicitly search-driven.
- **Complexity:** Lowest of any option here — but it doesn't meet the requirement anymore, so its simplicity doesn't matter.
- **Verdict:** Ruled out by the requirement itself, not by preference.

### 2. Next.js App Router, replacing Express entirely

Server Components fetch directly from Postgres via Drizzle (no API layer); Server
Actions handle mutations; Route Handlers only if an external API consumer ever shows up.

- **SEO:** Excellent — this is what the framework is built for.
- **Complexity:** Highest of the realistic options. A new rendering paradigm (Server Components, hydration boundaries, `'use client'` proliferation), and it discards the Express design work already done — permission middleware, the folder-per-feature structure, and Phase 0–2 of `kurobb-checklist.md` all get rebuilt as Next.js conventions instead.
- **Express preserved:** None — it's gone.
- **Verdict:** Technically excellent, disproportionate for a 100-DAU app maintained by one person. This is the option I originally reached for by default; it's not wrong, just more than this scale needs.

### 3. Next.js App Router in front of Express (two services)

Express stays exactly as designed, becomes internal-only (never called from the
browser). Next.js Server Components/Actions call it server-to-server for reads and
writes; the browser only ever talks to Next.js.

- **SEO:** Excellent, same as #2.
- **Complexity:** Two services, two deploys, one extra network hop on every server-rendered read (Next.js → Express → Postgres instead of Next.js → Postgres). At this traffic volume that hop's latency is irrelevant, but it's still two things to run locally and in production instead of one.
- **Express preserved:** Almost entirely — auth, permissions, counters, `bbob` all stay put.
- **Verdict:** A real option if you want Next.js specifically. The two-service topology is the cost; nothing here is broken, it's just more moving parts than the next option for the same outcome.

### 4. React Router v8, Framework Mode, mounted as Express middleware — **recommended**

Express stays as the one and only process. `@react-router/express`'s
`createRequestHandler` mounts a React Router v8 app (Framework Mode: loaders for reads,
actions for mutations) as Express middleware — one server, one deploy, one mental model.

- **SEO:** Same real SSR as Next.js — crawlable HTML, per-page `<title>`/meta tags via `meta()` exports per route. Framework Mode is the direct successor to Remix (Remix merged into React Router in 2024), so this is mature, not experimental.
- **Complexity:** The smallest jump from where `kurobb-design.md` already stands. No Server Components mental model, no `'use client'` boundaries — loaders/actions are just async functions, closer to what the Express routes in the checklist already look like.
- **Express preserved:** All of it. Permission middleware, atomic counters, `sessions`, `bbob` — none of it moves.
- **Maturity/risk:** Actively developed (React Router v8 already shipped, with continued investment — this isn't a project winding down), but a smaller ecosystem and community than Next.js. For a single internal app with no plugin/ecosystem dependency, that gap doesn't matter much.
- **Verdict:** Best fit for "keep Express, get real SSR, don't take on more than this scale needs."

### 5. Astro (islands architecture) — strong runner-up, worth a real look

Astro ships **zero client JS by default** and you opt in to hydration per-component
("islands"). Pages render fully server-side; only the pieces that need interactivity
(the reply composer, login form) ship JavaScript at all.

- **SEO:** Excellent, arguably the best of any option here — minimal JS payload means faster pages, and Core Web Vitals are a ranking factor independent of crawlability.
- **Why it fits a forum specifically:** A forum's access pattern is overwhelmingly read-heavy — browsing forums and reading threads — with occasional writes (reply, post, login). That's almost exactly Astro's target shape: static-feeling pages, small interactive islands. It's also worth noting forums are traditionally **multi-page**, not app-like — MyBB itself is a full page load per thread — so Astro's more MPA-shaped navigation isn't a UX downgrade for this product the way it might be for a dashboard.
- **Can still use the existing component choices:** Astro supports React components as islands, so `shadcn/ui` (§13 draft) isn't lost.
- **Complexity/risk:** A different mental model from "one SPA" — sharing client-side state (e.g. auth context) across independently-hydrated islands takes more deliberate wiring than it does in a normal SPA or React Router. Whether it can be mounted inside the existing Express process the same way React Router v8 can needs verification at implementation time — Astro has an adapter model for Node, but confirm the specifics before committing rather than assuming it matches option 4's clean middleware story.
- **Verdict:** Not the primary recommendation only because of that unverified integration story and the added mental-model shift — but if minimal JS / best-possible Core Web Vitals matters more than a unified SPA feel, this deserves a real prototype before ruling out.

### 6. Hand-rolled SSR in Express (`renderToString`, no framework)

Server-render the React tree yourself inside Express for the public pages, hydrate on
the client for interactivity.

- **Verdict: not recommended.** This reinvents exactly what Next.js/React Router already solve correctly — data serialization into the initial HTML, hydration-mismatch avoidance, cache-control semantics. Building it by hand is more work and more risk than adopting a maintained framework, not less.

### 7. Prerender/snapshot-for-bots ("serve crawlers a different page")

A proxy detects crawler user-agents and serves them a prerendered HTML snapshot while
real users get the SPA.

- **Verdict: not recommended.** Legacy pattern from before real SSR frameworks were viable. Carries real cloaking risk if the snapshot and live content ever drift, adds its own infrastructure (the prerender service) to keep in sync, and solves the same problem options 2–5 solve properly.

### 8. A different UI framework entirely (SvelteKit, etc.)

- **Verdict: not seriously considered.** Nothing about the SEO requirement points at a specific UI framework — it points at *rendering strategy*. Abandoning React now would also abandon `shadcn/ui` and every component decision already made, for no compensating benefit.

---

## Comparison

| Option | SEO | Complexity added | Express preserved | Processes | Maturity |
|---|---|---|---|---|---|
| 1. SPA, no SSR | Poor | Lowest | All | 2 (API + static frontend) | — |
| 2. Next.js, replaces Express | Excellent | Highest | None | 1 | Very mature |
| 3. Next.js in front of Express | Excellent | High | Almost all | 2 | Very mature |
| **4. React Router v8 in Express** | **Excellent** | **Low** | **All** | **1** | **Mature** |
| 5. Astro | Excellent+ | Medium | Unclear yet | 1 (likely) | Mature, different model |
| 6. Hand-rolled SSR | Excellent (if done right) | High, high risk | All | 1 | N/A — you're building the framework |
| 7. Prerender hack | Fragile | Medium | All | 2+ | Legacy pattern |
| 8. Different UI framework | Excellent | Highest (full restart) | All | varies | varies |

---

## Recommendation

**Primary: Option 4 — React Router v8, Framework Mode, mounted as Express middleware.**
It's the smallest step from where `kurobb-design.md` already stands, keeps every
backend decision made so far intact, and gives the same real SSR/SEO outcome as Next.js
without taking on a second rendering paradigm or a second process.

**Worth prototyping before fully committing: Option 5 — Astro.** If minimal JS and
best-possible page speed matter more than a unified single-app feel, it's a genuinely
strong fit for how read-heavy a forum is — just confirm the Express-mounting story
before relying on it, since that part isn't verified yet the way Option 4's is.

**Not recommended:** full Next.js (#2, #3) — excellent tools, disproportionate for this
scale and this team size; hand-rolled SSR (#6) and the prerender hack (#7) — both
reinvent solved problems with more risk than any framework option; a non-React
framework (#8) — no reason tied to the actual requirement.

## What changes elsewhere if Option 4 is chosen

- **§07 auth** — cookie-based sessions (a small array of session IDs in an httpOnly
  cookie, referencing `sessions` rows) replace the bearer-token-in-body plan. This is
  required by *any* SSR option, not specific to React Router — a server-rendered page
  can't read `localStorage` or an in-memory token.
- **§03 architecture diagram** — one process (Express + React Router v8 mounted in it)
  instead of a separate Vite dev server and API.
- **TanStack Query's role** — decided in `kurobb-design.md` §03: excluded from the
  barebones core (loaders/actions already give NodeBB-like no-full-reload navigation for
  free), scoped only to the future RPG layer's layout route, where its caching and
  optimistic-mutation model actually earns its keep.
- **`kurobb-checklist.md` Phase 0** — local dev no longer runs a separate Vite server;
  one `npm run dev` starts the Express+React-Router process.
