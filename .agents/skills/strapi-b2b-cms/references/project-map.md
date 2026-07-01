# Project Map

## Scope

This skill is for the Strapi backend repo at `D:\www\b2bcms`.

- Strapi root: `D:\www\b2bcms`
- Astro monorepo: `D:\www\b2b_frontend`
- These are separate Git repos and separate runtime contexts.

## Document Priority

Read docs in this order when you need context:

1. `CLAUDE.md`
   Use for the latest project overview and operational notes. Treat it as sensitive.
2. `docs/dev-schema.md`
   Use for current implementation-phase architecture and file ownership hints.
3. `docs/strapi_api_contract.md`
   Use for frontend-facing data contracts and public behavior expectations.
4. `agent.md`
   Use for concise project onboarding and safe-working boundaries.
5. `docs/r2.md`, `docs/B2B_Lead_Center.md`, `docs/Related_Products_Block.md`
   Use only for the relevant subsystem.

When docs conflict, trust current code first, then the higher-priority docs above.

## Repo Map

- `config/`
  Strapi server, middleware, plugins, DB config.
- `src/bootstrap.ts`
  Startup sync for Public permissions and some admin/view defaults.
- `src/admin/`
  Strapi Admin custom pages and admin UI customizations.
- `src/api/`
  Content types, controllers, routes, services, and lifecycles.
- `src/components/`
  Strapi components and Dynamic Zone schemas.
- `scripts/`
  Operational scripts such as sequence checks, tag migration, and R2 migration.
- `database/migrations/`
  SQL files that Strapi does not auto-run.
- `docs/`
  Local project docs, some current and some historical.

## Current Content Model Highlights

- `site`
  Non-i18n site config and deployment metadata.
- `site-layout`
  i18n layout shell replacing old menu/footer models.
- `product`
  i18n product model with SKU, slug, images, videos, tags, metadata, and business `status`.
- `page`
  i18n Dynamic Zone marketing pages.
- `blog`, `news`, `faq`, `keyword-cluster`, `tag`, `author`
  SEO and content expansion models.
- `lead`
  Non-i18n inquiry center model with public submission endpoint.
- `alert`
  Failure notification endpoint for automation flows.

Deprecated:

- `menu`
- `menu-item`
- `footer`

Do not revive deprecated models unless the user explicitly requests a reversal.

## Frontend Coupling

Any Strapi-side change may require Astro-side updates in `b2b_frontend`, especially for:

- Product or Page field additions
- Dynamic Zone component changes
- SEO metadata changes
- Site filtering or locale behavior
- Published/status visibility rules

Minimum Astro touchpoints for Dynamic Zone work:

- `b2b_frontend/packages/cms/src/types.ts`
- `b2b_frontend/packages/ui/src/components/sections/*`
- `b2b_frontend/packages/ui/src/components/ui/DynamicZone.astro`

## Working Boundaries

- Run Strapi commands with `npm` from `D:\www\b2bcms`.
- Run Astro commands with `pnpm` from `D:\www\b2b_frontend`.
- Do not leak `.env`, `CLAUDE.md`, or cloud/database/admin secrets into docs or generated files.
- Expect dirty files in the repo and avoid reverting unrelated changes.
