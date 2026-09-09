# STYLE.md — KuroBB

> Ink on paper. A forum, not a theme.

Reference: `mybb-sg/docs/STYLE.md` (the "Washi & Plum" reskin) — that document is a
specific *installation's* reskin (Naruto/ukiyo-e, three custom fonts, hanko seals, kanji
watermarks). This one is deliberately smaller: KuroBB is a platform other operators will
reuse, so its default look has to be genuinely neutral, not one community's aesthetic
baked into core. Per-install reskins (themes) are out of scope for now anyway
(`kurobb-design.md` §02). This is the plain, considered default underneath that.

One idea worth keeping from the reference doc regardless of theme: **spend an accent
color sparingly, not everywhere.** That's carried over below.

---

## 1. Concept

**Name:** Ink & Paper. Near-black ink text on a warm, slightly-off-white page — a
forum meant to be read, not decorated. One accent color, used only where it means
something (links, primary actions, unread markers) — never as background filler.

**Keywords:** ink · paper · quiet · legible · one accent

---

## 2. Typography

Two fonts, not three:

```
Display / headings:  Newsreader   (Google Fonts) — weights 400, 600, 700
Body / UI:            IBM Plex Sans (Google Fonts) — weights 400, 500, 600
```

```html
<link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

Newsreader is a serif — it's for forum names, thread titles, and section headings only,
where a little character earns its place. Everything else (nav, buttons, form labels,
post bodies, table text) is IBM Plex Sans, because a forum is read in long, dense
stretches and that's what needs to stay boring and legible.

| Element | Font | Size | Weight |
|---|---|---|---|
| Forum/thread title | Newsreader | 1.5rem | 600 |
| Section heading | Newsreader | 1.125rem | 600 |
| Nav / buttons | IBM Plex Sans | 0.875rem | 500 |
| Post body | IBM Plex Sans | 1rem | 400 |
| Metadata (dates, usernames in lists) | IBM Plex Sans | 0.8125rem | 400 |
| Table headers | IBM Plex Sans | 0.75rem, uppercase, letter-spacing 0.05em | 600 |

No decorative type. No third face for "flavor" — that's exactly the kind of
installation-specific personality that belongs in a reskin, not the default.

**Links** — a row-level link (a forum/thread name that's the whole row's click target)
is `text-ink` with no underline; an inline text link within a sentence (post body links,
"Back to thread") is `text-accent` with no underline at rest, underline on hover. The
difference is deliberate: row titles read as headings that happen to be clickable,
inline links need the color signal since they sit inside body text.

**Font loading** — the Google Fonts `<link>` above already sets `display=swap`, so text
never blocks on the font loading. Self-hosting the font files (removing the extra
DNS/connection hop to Google's CDN) is a legitimate later optimization for LCP given how
much this project has weighed Core Web Vitals elsewhere — not required to ship a
readable default, just don't mistake "fine for now" for "as good as it gets."

---

## 3. Color

One accent, both modes. Everything else is ink/paper neutrals.

### Light

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#faf9f6` | Page background — warm paper, not stark white |
| `--surface` | `#ffffff` | Cards, table rows, form fields |
| `--surface-2` | `#f1efe9` | Nav bar, table header row, subtle section backgrounds |
| `--border` | `#e2ded4` | All borders and dividers |
| `--ink` | `#1a1712` | Primary text, headings |
| `--ink-muted` | `#6b6558` | Secondary text — metadata, descriptions, timestamps |
| `--accent` | `#9c3b2e` | Links, primary buttons, unread markers — nothing else |
| `--accent-soft` | `#f4e6e2` | Accent background tint (e.g. unread row highlight) |

### Dark

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#15130f` | Page background |
| `--surface` | `#1d1a15` | Cards, table rows, form fields |
| `--surface-2` | `#252017` | Nav bar, table header row |
| `--border` | `#3a352a` | All borders and dividers |
| `--ink` | `#ede8dd` | Primary text, headings |
| `--ink-muted` | `#a39c8a` | Secondary text |
| `--accent` | `#d9695a` | Brightened for contrast on dark |
| `--accent-soft` | `#3a221d` | Accent background tint |

Rule carried over from the reference doc: the accent appears in exactly three kinds of
places — a link, a primary button, an unread/active indicator — never as a background
fill, a border on every card, or body text color. If it starts showing up as decoration
rather than meaning, that's a sign something's using it wrong.

### Implementation

Defined as Tailwind theme tokens in `app/app.css` (already imports `tailwindcss`):

```css
@theme {
  --color-bg: #faf9f6;
  --color-surface: #ffffff;
  --color-surface-2: #f1efe9;
  --color-border: #e2ded4;
  --color-ink: #1a1712;
  --color-ink-muted: #6b6558;
  --color-accent: #9c3b2e;
  --color-accent-soft: #f4e6e2;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-bg: #15130f;
    --color-surface: #1d1a15;
    --color-surface-2: #252017;
    --color-border: #3a352a;
    --color-ink: #ede8dd;
    --color-ink-muted: #a39c8a;
    --color-accent: #d9695a;
    --color-accent-soft: #3a221d;
  }
}
```

That gives Tailwind utilities for free — `bg-bg`, `bg-surface`, `text-ink`,
`text-ink-muted`, `border-border`, `text-accent`, `bg-accent`, etc. No manual theme
toggle for now — `prefers-color-scheme` only, matching what the rest of the product
does today. A real toggle (with `localStorage` + a `data-theme` override, the pattern
the reference doc already uses) is a fine later addition, not needed to ship a
readable default.

---

## 4. Layout

- Max content width: `42rem` (`max-w-2xl`) for reading-focused pages (thread view,
  forms). Admin tables and the forum list can run wider (`max-w-4xl`) since they're
  scannable, not read top-to-bottom. **Auth pages** (`auth.register`/`auth.login`/
  `auth.logout`) are narrower still — `max-w-sm`, vertically centered
  (`min-h-[60vh] flex flex-col justify-center`) — a login form isn't reading content,
  it's a single small task, and the reading-width column reads as too much empty space
  around three fields. Added here when Step 4's Auth group actually needed it, not
  speculative.
- Page padding: `1.5rem` mobile, `2rem` desktop (`p-6 md:p-8`).
- Vertical rhythm between sections: `gap-8` (2rem) on the page's main flex column, not
  per-element margins — avoids the classic collapsing/doubling margin bugs.
- Borders, not shadows, for separation — `border border-border`, never `box-shadow`.
  One consistent way to say "this is a distinct block."

---

## 5. Components

Matched to what's actually built (`kurobb-checklist.md` Phases 1–3, 8) — nothing
speculative.

**Nav bar** — `bg-surface-2 border-b border-border`, holds the KuroBB wordmark
(Newsreader, 600), and links to Forums / Settings / Admin (only rendered if the current
user `isAdmin`) / Log in or the username + Log out.

**Forum list row** — `border-b border-border py-3`, forum name in Newsreader linking to
`/forums/:id`, thread count in `text-ink-muted text-sm`, description below in
`text-ink-muted text-sm`. Nested child forums indent `pl-6`.

**Thread list row** — same row shape as a forum row; thread title links to
`/threads/:id`; reply count in `text-ink-muted text-sm`. No unread state yet (no
read-tracking is built — see `kurobb-design.md` §05's read/unread design, not
implemented), so `--accent-soft` unread-row styling has nothing to attach to yet. Add it
when that feature exists, not before.

**Post card** — `bg-surface border border-border rounded-none p-4` (no rounded corners
— borders-not-shadows means sharp corners read as intentional, not unfinished).
Username line in `text-ink font-medium`, timestamp in `text-ink-muted text-xs`, body
rendered from `body_html_cache` below.

**Buttons**
- Primary (submit, save, create): `bg-accent text-white px-4 py-2 font-medium`, hover
  darkens slightly.
- Secondary (cancel, back links): `border border-border text-ink px-4 py-2`, no fill.
- Destructive (delete forum): same shape as secondary, `text-accent` label — no separate
  "danger red," since accent already reads as the one color that means "pay attention,"
  and a second warning color would dilute that.

**Forms** — label above input, `text-ink-muted text-sm` for the label, `border
border-border bg-surface px-3 py-2` for inputs, full width within their container. Error
text (from `VALIDATION_ERROR`'s `details`, §06) in `text-accent text-sm` under the
relevant field.

**Tables** — one convention, shared by all three admin table pages
(`admin.forums`, `admin.groups`, `admin.groups.$groupId`), not restyled ad hoc per file:
`bg-surface-2` header row, `text-xs uppercase tracking-wide text-ink-muted` header text,
body rows `border-b border-border`, no zebra striping (borders already separate rows;
striping plus borders is redundant separation).

**Pagination** — shared by `forums.$forumId` and `threads.$threadId`, not two slightly
different implementations: `text-ink-muted text-sm` for "Page X of Y", `text-accent` for
the Previous/Next links, both hidden (not disabled-and-visible) when there's no
adjacent page.

**Empty states** — not an edge case for this product. Every fresh KuroBB install starts
with zero forums (`kurobb-design.md` §01 — no seed data, standalone by design), so "No
forums yet" is realistically the *first* thing a real admin ever sees. `text-ink-muted`,
centered in the content column, with the relevant call-to-action link (Create a forum /
New thread) directly beneath it rather than only in the page's other corner — the empty
state should point at the fix, not just name the absence.

**Tags/badges** (group names, status pills like "Deferred"/"Post-MVP" if ever surfaced
in a future admin UI) — `border border-border text-ink-muted text-xs uppercase
tracking-wide px-2 py-0.5`, no fill. Reserve filled/accent badges for something that
truly needs to stand out (e.g. "Forbidden" states), not routine labels.

---

## 6. Accessibility

- **Focus-visible**: every interactive element (links, buttons, inputs, selects) gets a
  visible `outline: 2px solid var(--color-accent)` with `outline-offset: 2px` on
  `:focus-visible` — not `:focus`, so a mouse click doesn't show a ring a keyboard tab
  should. This is the one place the accent color's "used in exactly three roles" rule
  (§3) gets a fourth: focus indication is structural, not decorative, same reasoning as
  why it's allowed on links and buttons already.
- **Contrast — checked, not assumed.** Computed against WCAG's relative-luminance
  formula directly from the hex values in §3, not eyeballed: `--ink-muted` on `--bg` is
  ~5.5:1 (light) / ~6.8:1 (dark); `--accent` on `--bg` is ~6.5:1 (light) / ~5.4:1
  (dark); white text on `--accent` (primary buttons) is ~6.8:1 (light). All clear WCAG
  AA's 4.5:1 minimum for normal text in both modes with real margin, not a near-miss.
  Re-check this if any token in §3 changes — the margin is comfortable, not infinite.

---

## 7. Responsive

- Nav bar collapses forum/settings/admin links into a single `≡` menu below `640px` —
  not built yet; today's nav can just wrap.
- Admin tables get `overflow-x-auto` on their container below `768px` rather than
  trying to reflow columns — simplest correct fix for a table that's inherently wide.
- Forms and post cards are already full-width-within-max-width, so they need no special
  mobile handling beyond the page padding in §4.

---

## 8. What this deliberately leaves out

No theme toggle UI, no per-install reskinning hooks, no decorative iconography, no
custom illustrations, no second accent color for "variety." All of that is either a
future phase's problem (theming is explicitly out of scope, `kurobb-design.md` §02) or
actively works against the point of a shared default — a *specific* community's visual
identity (like `mybb-sg`'s washi/plum reskin) is exactly what a per-install theme is for,
not what ships in core.
