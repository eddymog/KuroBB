# Frontend Design Implementation Plan

**Doc:** KRB-005 · Implements [STYLE.md](./STYLE.md) across the pages already built in
[kurobb-checklist.md](./kurobb-checklist.md) Phases 1–3 and 8. No new features, no new
routes, no behavior changes — this is a visual/structural pass only.

---

## Scope

Every route that exists today gets restyled. Nothing that doesn't exist yet (Phases 5–7:
moderation, search, plugins) is touched, since there's nothing there to style.

Routes in scope: `home`, `forums`, `forums.new`, `forums.$forumId`,
`forums.$forumId.new`, `threads.$threadId`, `posts.$postId.edit`, `auth.register`,
`auth.login`, `auth.logout`, `users.$userId`, `settings`, `admin`, `admin.forums`,
`admin.forums.$forumId.edit`, `admin.groups`, `admin.groups.$groupId`, plus
`root.tsx`'s document shell and `ErrorBoundary`.

---

## Step 1 — Foundation: tokens, fonts, base element styles

Everything else in this plan depends on this landing first.

- [x] `app/app.css`: STYLE.md §3's tokens added — light values in the bare `@theme`
  block, dark values re-declared under `@media (prefers-color-scheme: dark)`.
  **Real bug found and fixed here, not anticipated by this checklist item:** the dark
  override was first written as a second `@theme { ... }` block nested inside the media
  query. `@theme` is a compile-time token registry, not a runtime cascade — nesting it
  in a media query doesn't scope it, it just made Tailwind's build overwrite the light
  block's values entirely. Confirmed by grepping the compiled CSS output: the light hex
  values (`faf9f6` etc.) were completely absent, meaning every user would have seen dark
  colors regardless of their actual system preference. Fixed by making the dark override
  a plain CSS custom-property reassignment on `:root` inside the media query, not
  another `@theme` block — verified afterward that both light and dark values now exist
  in the compiled output, dark correctly scoped inside `@media (prefers-color-scheme:dark)`.
- [x] `app/root.tsx`: Google Fonts `<link>` swapped from Inter to Newsreader + IBM Plex
  Sans (STYLE.md §2). `--font-sans` (body) and `--font-serif` (headings) theme tokens
  both added in `app.css`.
- [x] Base element styles for BBCode output: `.post-body` wrapper class in `app.css`
  (blockquote left-border, `pre` on `surface-2`, `a` in `accent`, image max-width,
  list indentation) — real CSS, not Tailwind utilities, since `body_html_cache` is
  raw HTML via `dangerouslySetInnerHTML`, not JSX.
- [x] Focus-visible base style (STYLE.md §6): global `:focus-visible` rule in
  `app.css`, confirmed present in the compiled CSS output (not just the source).
- [x] Typecheck + build after this step alone, before touching any page — confirms the
  token/font wiring itself doesn't break anything before component work starts on top
  of it.

## Step 2 — Shared UI primitives

Fifteen-plus route files repeating the same button/field/card class strings is the
exact kind of duplication worth avoiding — a small `app/components/ui/` set, not a full
design system:

- [x] `Button.tsx` — `variant: "primary" | "secondary" | "destructive"` per STYLE.md §5.
- [x] `Field.tsx` — label + input/textarea/select wrapper + error slot. Kept to an
  explicit, minimal prop set (`name`, `label`, `type`, `required`, `defaultValue`,
  `placeholder`, `minLength`, `error`) matching actual usage across the real route
  files, rather than a full `HTMLAttributes` passthrough — that fought TypeScript's
  discriminated unions for no real benefit at this project's size.
- [x] `NavBar.tsx` — wordmark + Forums always; Settings/Admin conditional on
  logged-in/`isAdmin`; username + a **link** to `/auth/logout` (not an inline logout
  action — confirmed per Step 3's note).
- [x] `PostCard.tsx` — built to take a resolved `authorLabel` string rather than a
  `userId`, keeping it presentational only. **Real gap surfaced, not yet fixed:**
  `posts/repository.ts`'s `listPostsForThread` only selects the bare `posts` row — no
  join to `users` exists anywhere today, so there's currently no way to resolve a post's
  author to a real username. Wiring `PostCard` into `threads.$threadId.tsx` in Step 4
  has to add that join; it's not invented here.
- [x] `PageHeading.tsx`.
- [x] `Pagination.tsx` — the "Page X of Y — Previous/Next" block, previously duplicated
  almost verbatim between `forums.$forumId.tsx` and `threads.$threadId.tsx`.
- [x] Table convention — built in Step 4's Admin group (not here, since no table
  existed to abstract from yet), as an actual `Table`/`Th`/`Td` component after all
  rather than copy-pasted classes: `<th>`/`<td>` carry per-cell classes regardless, so
  wrapping them cost nothing beyond what "copy the exact classes" would have, while
  guaranteeing the three admin table pages can't drift the way copied strings can.

These are genuinely reusable now (every page needs at least a heading and most need
buttons/fields), not speculative — built because Step 4 would otherwise copy the same
class strings fifteen times.

## Step 3 — Root layout: thread the current user through

`app/root.tsx` currently has no `loader` at all, so there's no way for `NavBar` to know
who's logged in without every single page re-fetching that itself.

- [x] Add a `loader` to `root.tsx` that calls `getCurrentUser(request)` and returns it.
  **Real thing caught here, not anticipated by this checklist item:** `getCurrentUser`
  returns the *full* user row, `passwordHash` included, and `loaderData` is serialized
  straight into the page for hydration — visible in view-source, not just "unused in
  the render." The loader strips it down to `{ id, username, isAdmin }` before
  returning, rather than trusting `NavBar` to just not display the rest. Verified with
  `curl` against a real logged-in page: zero occurrences of `passwordHash` or an
  `argon2$` hash anywhere in the served HTML.
- [x] Render `<NavBar user={...} />` in the `App` export, above `<Outlet />`. Verified
  all three real states against the live app: logged-out shows only "Log in"; a real
  admin (`eddy`) shows username + Settings + Admin + Log out; a real non-admin
  (`alice`) shows username + Settings + Log out, correctly **without** Admin. (First
  pass at checking alice's case showed Admin incorrectly — turned out to be a stale
  test file from an earlier command in this session, not a real bug: confirmed alice's
  session hash maps to her own `user_id` in the database and `is_admin=false` there,
  then re-fetched fresh and got the correct result. Worth recording that the anomaly was
  chased down rather than either alarmed over or waved away.)
- [x] `NavBar`'s logout is a plain link to `/auth/logout` (which shows the existing
  confirm-button page), not an inline logout form in the nav itself — logout is a
  mutation, and the nav shouldn't quietly grow a second, different logout flow next to
  the one that already exists.
- [x] Confirm this doesn't create a duplicate session lookup per page — `getCurrentUser`
  re-queries the database on purpose (§07 — a revoked session must stop working
  immediately, not via a cache), so a page like `/settings` that also calls
  `requireUser(request)` in its own loader will genuinely run the query twice per
  request. That's a real, small, known cost of the existing no-cache design, not a new
  bug this step introduces — worth noting here rather than "fixing" by adding caching
  that §07 deliberately ruled out.

## Step 4 — Page-by-page restyle

Grouped in the order they'll actually get done, each group buildable and verifiable
independently:

- [x] **Core browsing** — `home`, `forums`, `forums.$forumId`, `threads.$threadId`.
  Forum/thread list rows per STYLE.md §5; `PostCard` for each post in a thread; reply
  form uses `Field`; both paginated pages use the shared `Pagination` component.
  **Real gap actually fixed here, not just wrapped around**: `PostCard` needed a
  resolved `authorLabel`, and `posts/repository.ts`'s `listPostsForThread` had never
  joined to `users` at all — added a left join (not inner: `userId` is nullable for
  guest posts, §07) and a `"Guest"` fallback in `posts/service.ts`. Verified against
  real data: `thread 1`'s pre-Phase-2 posts correctly show "Guest" (they genuinely have
  no `userId`, created before auth existed), and a freshly-created post as `eddy`
  correctly shows "eddy" — confirmed the join resolves a real username, not just that it
  doesn't crash.
- [x] **Empty states, specifically** — `forums.tsx`'s "No forums yet" and
  `forums.$forumId.tsx`'s "No threads yet" get real treatment per STYLE.md §5. **Not
  independently verified live** — every forum in the current dev database has threads
  and the database itself has forums, so the empty branch wasn't exercised against a
  real empty state without deleting real data, which wasn't worth doing just to check a
  styling branch. Confirmed correct by reading the conditional render logic instead;
  worth an eyes-on check whenever a genuinely fresh install is spun up.
- [x] **Write forms** — `forums.new`, `forums.$forumId.new`, `posts.$postId.edit`. All
  three are now `Field` + `Button` compositions. Implemented via a new
  `safeParseFormData()` (`server/lib/validation.ts`) — a deliberate *sibling* to the
  existing throwing `parseFormData`, not a change to it, so every other action
  (register, login, admin, replies) keeps its current throw-to-`ErrorBoundary`
  behavior unless it specifically opts into field-level display. Verified against the
  real running app on all three forms: an invalid submission now returns a plain
  `200` with the message rendered inline via `Field`'s error slot (`text-accent`), not
  a thrown response to the root boundary — and the happy path (a real forum actually
  gets created) still works unchanged.
- [x] **Auth** — `auth.register`, `auth.login`, `auth.logout`. Centered `max-w-sm` card
  layout — added to STYLE.md §4 as planned. **Scope deliberately extended beyond what
  this group originally listed**: `register`/`login` also got `safeParseFormData`
  (the write-forms group's fix), not just restyling — STYLE.md's form spec doesn't
  distinguish auth forms from any other, so leaving them still-throwing-to-the-boundary
  would have meant an invalid email or a too-short password crashed to a full error page
  while the same mistake on a forum-creation form showed an inline message. Verified
  against the real app: invalid email + short password on register → `200` with both
  field errors inline; empty fields on login → `200` with both field errors inline; a
  genuinely wrong password on login → still a real `401` (that's a service-layer
  `UNAUTHENTICATED` throw, §07, not a Zod failure — correctly untouched by this pass);
  happy-path register still creates a real account.
- [x] **Profile** — `users.$userId`, `settings`. Avatar image, signature rendered as
  plain text (it's raw BBCode source today, per §04 — not run through `renderBbcodeToHtml`
  anywhere yet, which this pass doesn't change, only notes). Found and fixed a real bug
  while restyling, same class as root.tsx's earlier passwordHash leak: `settings.tsx`'s
  loader did `return { user }` with `user` straight from `requireUser()` — the full row,
  including `passwordHash` — headed for `loaderData`/hydration. Fixed by stripping it to
  `{id, username, avatarUrl, signature}`, same shape as the earlier root.tsx fix. Also
  switched `settings.tsx`'s action to `safeParseFormData` (avatarUrl/signature are
  optional fields with a URL-format check — worth inline errors, same reasoning as the
  Auth group's extension) and restyled both routes with `Field`/`Button`/`PageHeading`.
  Verified against the real app: `GET /settings` has zero occurrences of
  `passwordHash`/`argon2$` in the served HTML; an invalid avatar URL → `200` with an
  inline "Enter a valid URL." error; a valid save → `302`, persisted to the real `users`
  row (checked via `psql`), and reflected back on reload; the public profile at
  `/users/:id` shows the updated avatar/signature with no auth-only fields exposed;
  unauthenticated `GET /settings` still correctly `401`s.
- [x] **Admin** — `admin`, `admin.forums`, `admin.forums.$forumId.edit`,
  `admin.groups`, `admin.groups.$groupId`. Table styling per STYLE.md §5; the
  per-row `form`-attribute pattern in `admin.groups.$groupId.tsx` (needed because a
  `<form>` can't be a direct child of `<tr>`) stays exactly as built — only the visual
  styling of the cells/selects changes, not that structure. Added a shared
  `Table`/`Th`/`Td` primitive (`app/components/ui/Table.tsx`) since this is the first
  group with real tables — STYLE.md's Table convention was written ahead of this pass,
  now actually implemented. `admin.groups.tsx` was a plain `<ul>`; converted to the
  same shared table per STYLE.md's own description of it as one of "all three admin
  table pages." `admin.forums.$forumId.edit` and `admin.groups.tsx`'s create-group form
  switched to `safeParseFormData` for inline Zod errors, consistent with the other
  write-forms groups; `admin.groups.$groupId`'s add-member/set-permission actions were
  left on `parseFormData` (throw-to-boundary) as the plan called for — no scope
  extension there, since those aren't Zod-shaped user mistakes the way a blank forum
  name is. Verified against the real app end to end, temporarily promoting the
  `stylecheck` test account to admin (reverted after) since the actual admin account's
  password isn't known to this session: `/admin` and `/admin/forums` render real forums
  in the new table; `/admin/forums/:id/edit` populates its parent dropdown from real
  other forums, an empty name → inline "Name is required.", and the delete button is
  correctly disabled when `threadCount > 0`; `/admin/groups` create actually inserted a
  new row (checked via `psql`, then deleted); `/admin/groups/:id` add-member and
  remove-member both wrote real `user_groups` rows; the per-row permission form wrote a
  real `forum_permissions` row (`deny`/`deny`) and the `<select>`s showed the correct
  `selected` option on reload — all test-only mutations (the permission, the added
  member, the test group, `stylecheck`'s admin flag) were reverted afterward.
- [x] **Document shell** — `root.tsx`'s `ErrorBoundary`. Restyled with the same page
  shell (`NavBar`, `PageHeading`, `max-w-2xl` padding) plus a "Back to forums" link.
  Root's `ErrorBoundary` substitutes for the entire `App` component (NavBar included)
  whenever no route below root defines its own boundary, so the boundary has to render
  NavBar itself, not rely on `App` still being on screen — confirmed root's own
  `loaderData` (the `{user}` shape from its loader) is still passed into
  `Route.ErrorBoundaryProps` even when the error came from a child route's loader/action,
  since root's own loader never throws. Verified against the real app: an unmatched
  route → real `404` with the styled shell; `/users/99999` (a real `NOT_FOUND` thrown via
  `throwAppError`) → styled shell showing "NOT_FOUND" / "User 99999 does not exist.";
  a logged-in non-admin hitting `/admin` → real `403` "FORBIDDEN" / "Only an admin can do
  that.", with NavBar correctly still showing the logged-in username and no Admin link —
  confirming the boundary's nav state isn't stale or logged-out by default.

**Step 4 complete.**

## Step 5 — Verify

Same bar as every other phase in `kurobb-checklist.md` — build success and structural
correctness are verifiable from here; actual visual appearance is not, and won't be
claimed as verified.

- [x] `npm run typecheck` and `npm run build` clean after each group in Step 4, not just
  once at the end — catches a broken page immediately rather than after fifteen files
  of changes. Done incrementally after every group (Core browsing, Write forms, Auth,
  Profile, Admin, Document shell) throughout Step 4, not just as a final pass.
- [x] Bundle-size sanity check: confirm the per-route JS chunks (already tiny — under
  ~1.2KB each as of Phase 3) don't balloon. Final build after Step 4: still tiny —
  largest route chunk is `admin.groups.$groupId` at 3.63KB (genuinely the busiest page:
  three forms plus a permissions table), everything else at or under ~1.6KB; the shared
  framework chunks (`entry.client`, `jsx-runtime`) didn't grow at all, confirming pure
  Tailwind utility classes added zero JS weight.
- [x] `curl` + structural `grep` against the running app for each restyled route —
  confirms the expected classes/elements are actually present in the rendered HTML and
  nothing 500s, the same verification method used in every prior phase. Done per-group
  throughout Step 4 against real data (real forums/threads/posts/users/groups/
  permissions), not synthetic fixtures — see each group's note above for specifics.
- [x] **Color contrast — already checked, not deferred to this step.** STYLE.md §6 has
  the computed WCAG ratios for every token pair actually used for text (`ink-muted`,
  `accent`, white-on-`accent`) in both modes — all clear the 4.5:1 AA minimum with real
  margin. Re-verify only if a token in STYLE.md §3 changes.
- [x] Confirm the `:focus-visible` rule from Step 1 is actually present in the built CSS
  output (`grep` the compiled stylesheet, not just the source) — a real, if narrow,
  category of Tailwind v4 mistake is a token or rule getting written but never reaching
  the production bundle because nothing in the scanned JSX references it. Confirmed:
  `:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}` is present,
  once, in the compiled `root-*.css`, referencing the plain `--color-accent` custom
  property rather than a `@theme` token — so it isn't subject to the earlier
  dark-mode-`@theme`-nesting bug (that bug erased light-mode `@theme` values; this rule
  never depended on `@theme` at all).
- [x] **What this can't verify, and won't claim to:** whether it actually looks good,
  whether light/dark mode both read correctly, whether the Newsreader/Plex Sans pairing
  works in practice. That needs your own eyes in an actual browser — same limitation
  flagged when Phase 0's SSR output was first verified by `curl`, just more visible now
  that appearance is the point. Not claimed as verified here; open for you to check.

**Step 5 complete, with the one caveat above — visual appearance needs a human look.**

---

## Explicitly not in this pass

- No dark-mode toggle UI (STYLE.md §3 — `prefers-color-scheme` only, for now).
- No new components beyond Step 2's short list — no icon library, no animation, no
  component variants nothing here actually uses.
- No changes to routing, data model, or permission logic anywhere, except the one
  narrow, called-out exception in Step 4 (wiring validation errors to field-level
  display, which STYLE.md's form spec requires to mean anything).
