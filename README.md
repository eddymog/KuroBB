# KuroBB

A standalone forum platform (Node.js/TypeScript), built from scratch — with an optional,
one-time migration path from an existing MyBB installation. MyBB is a reference for
which features actually matter, not a dependency: KuroBB works as a fresh, empty install
the way any forum software does on day one.

See [`claude.md`](./claude.md) for the project's scope and working agreement, and
[`kurobb-design.md`](./kurobb-design.md) for the living architecture doc (source of
truth for stack decisions) — start there for anything not covered below.

## Stack

Node.js 22 LTS · Express · React Router v8 (Framework Mode, SSR) · PostgreSQL 16 ·
Drizzle ORM · Tailwind CSS v4 · argon2 · server-side sessions (no JWT).

## Getting started

```bash
docker compose up -d postgres   # Postgres 16 on localhost:5433
npm install
npm run dev                     # http://localhost:3000
```

Other useful commands:

```bash
npm run typecheck   # react-router typegen + tsc
npm run build        # production build
npm run db:migrate   # apply pending Drizzle migrations
npm run db:studio    # browse the database in Drizzle Studio
```

There's no seed data by design — register a real account and create a real forum
through the product itself, the way a fresh install works.

## Deployment

Render (app) + Neon (Postgres) — see `render.yaml` and §14 of `kurobb-design.md` for the
full reasoning and setup steps.

## Docs

- [`claude.md`](./claude.md) — scope, MVP boundaries, working agreement
- [`kurobb-design.md`](./kurobb-design.md) — architecture, data model, API surface (KRB-001)
- [`kurobb-checklist.md`](./kurobb-checklist.md) — build-phase tracking (KRB-002)
- [`STYLE.md`](./STYLE.md) — visual design system
- [`docs/PLAN.md`](./docs/PLAN.md) — original vision doc (NodeBB-shaped platform + RPG layer)

## License

[AGPLv3](./LICENSE).
