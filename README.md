# compliance-AI

AI-native multi-framework compliance platform.

**Frameworks covered out of the box:** SOC 2 · GDPR · EU AI Act · ISO 27001.

## Status

`v0.0.1` — Day 1 scaffold landed:

- Monorepo skeleton (Turbo + pnpm workspace)
- `packages/frameworks` — typed Control model + seed catalogs for all four frameworks
- `packages/db` — Drizzle schema (organizations, users, controls) + RLS policies
- `apps/web` — Next.js 16 shell with `/controls` catalog index

See [docs/build-plan.md](docs/build-plan.md) for the 5-day build plan.

## Quickstart

```bash
pnpm install
pnpm --filter @compliance-ai/web dev
# open http://localhost:3000
```

The `/controls` page renders the four seed catalogs directly from
`packages/frameworks` — no database is needed yet.

## Monorepo layout

```
apps/
  web/                Next.js 16 web app
packages/
  frameworks/         Control discriminated union + seed catalogs
  db/                 Drizzle schema, RLS, client
docs/
  build-plan.md       5-day roadmap
```

## Design notes

**Control model — hybrid B + A.**
- In code: per-framework types (`SOC2Control`, `GDPRControl`, `EUAIActControl`,
  `ISO27001Control`) unioned as `Control`. Lets agents and UI reason with full
  type safety.
- In the DB: one `controls` table with a `framework_metadata jsonb` column
  holding the framework-specific fields. Cross-framework dashboards stay
  single-query and new frameworks don't require migrations.

See [packages/frameworks/src/control.ts](packages/frameworks/src/control.ts) and
[packages/db/src/schema/controls.ts](packages/db/src/schema/controls.ts).

## License

Apache-2.0
