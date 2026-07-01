# Frontend Rules

## Data Layer Rules

`packages/cms/src/client.ts` is the shared Strapi fetch layer.

Current conventions:

- auto-prepend `/api`
- allow `populate`, pagination, sorting, and extra params
- apply Site filter by default unless explicitly disabled
- fail soft by returning `null` or `[]`
- log request URLs and warnings during build

Important:

- `getCurrentSite()` resolves the current site by `SITE_SLUG`
- `getSiteLayout()` fetches layout data separately
- `getCollection()` and `getOne()` are the generic collection/single helpers
- `getGlobal()` is fetched without normal site filter assumptions

## Site Filter Rules

`packages/cms/src/site-resolver.ts` is the source of truth for current-site resolution.

Rules:

- `SITE_SLUG` drives multi-site filtering
- `withSiteFilter()` appends `filters[site][slug][$eq]`
- `STRAPI_URL` or `PUBLIC_STRAPI_URL` define the backend base URL

Do not scatter ad hoc site-filter logic through app pages when `packages/cms` can own it.

## Type Rules

`packages/cms/src/types.ts` is the frontend contract layer for Strapi data.

Whenever a Strapi field shape changes:

- update `packages/cms/src/types.ts`
- update any UI component props that depend on that type
- update Dynamic Zone unions if section coverage changes

## Dynamic Zone Rules

Dynamic Zone support is multi-file by design.

When adding or changing a section:

1. update the Strapi component/schema side
2. update `packages/cms/src/types.ts`
3. add or update the section component in `packages/ui/src/components/sections/`
4. register it in `packages/ui/src/components/ui/DynamicZone.astro`
5. verify the relevant page route renders it correctly

Current registry includes:

- `sections.hero`
- `sections.bottom-actions`
- `sections.feature-columns-group`
- `sections.feature-rows-group`
- `sections.testimonials-group`
- `sections.large-video`
- `sections.rich-text`
- `sections.pricing`
- `sections.lead-form`
- `sections.faq-group`
- `sections.comparison-table`
- `sections.statistics`
- `sections.cta-banner`
- `shared.related-products`
- `shared.faq-reference`

## SEO and JSON-LD Rules

Shared SEO helpers live in:

- `packages/ui/src/lib/seo.ts`
- `packages/ui/src/lib/schemas.ts`
- `packages/ui/src/components/layout/SEOTags.astro`
- `packages/ui/src/components/layout/JsonLd.astro`
- `packages/ui/src/components/layout/BreadcrumbList.astro`

Expect pages to:

- compute canonical URLs
- pass SEO props into `BaseLayout`
- register noindex pages when needed
- inject the correct JSON-LD for the route type

Do not duplicate SEO assembly logic in many places when shared helpers already exist.

## Sitemap and Robots Rules

Build-time noindex exclusion is handled by `packages/cms/src/sitemap-exclude.ts`.

Rules:

- page templates call `registerNoindex(path)`
- app `astro.config.mjs` sitemap filter calls `isNoindex(path)`
- this relies on module-level memory during one SSG build process

`robots.txt.ts` exists per app and should stay aligned with current crawl policy.

## Link Index Rules

`packages/cms/src/link-index.ts` is a build-time content index with module-level caching.

Use it for:

- internal related-link generation
- slug-based helper lookups
- lightweight cross-content matching during build

Do not rebuild ad hoc site-wide content maps in page files when this module already covers the use case.

## Theme Rules

Theme integration spans:

- `packages/theme`
- app `tailwind.config.mjs`
- app `src/tokens.css`
- Vite aliases in app `astro.config.mjs`

Rules:

- shared components should use semantic classes and theme tokens
- changing a theme should mostly be config and token work, not component rewrites
- app theme wiring should stay minimal and consistent

## SSG and JS Rules

This monorepo is SSG-first.

Prefer:

- `.astro` components for non-interactive UI
- minimal client-side JS
- native HTML/CSS behavior where possible
- shared page components instead of app-specific duplicated markup

There are a few React helpers in `packages/ui/src/react`, but do not default to React islands when Astro-native rendering is enough.

## Vercel Rules

Each app owns its own `vercel.json`, but builds from the monorepo root.

Implications:

- app deploys depend on shared workspace health
- root install and turbo filtering are part of the deploy contract
- changes to package exports or workspace wiring can break deploys for multiple apps

Check:

- `vercel.json`
- app `package.json`
- root `package.json`
- `turbo.json`
- `pnpm-workspace.yaml`

before changing build behavior.

## Validation Checklist

- Run `pnpm build` from `b2b_frontend` after shared package changes when feasible.
- For targeted work, build at least the affected app.
- For package export changes, verify import paths still resolve.
- For route or SEO work, inspect generated behavior, not just TypeScript.
- For Dynamic Zone or Strapi contract changes, verify both type coverage and rendered output.
