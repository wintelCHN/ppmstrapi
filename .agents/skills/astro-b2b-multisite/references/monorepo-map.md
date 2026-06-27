# Monorepo Map

## Scope

This skill is for the Astro frontend monorepo at `D:\www\b2bcms\astro_site`.

- Workspace root: `D:\www\b2bcms\astro_site`
- Package manager: `pnpm`
- Task runner: `turbo`
- Deployment target: Vercel, one project per app

## Workspace Layout

- `apps/*`
  Deployable sites. Each app is its own Astro project and Vercel target.
- `packages/cms`
  Shared Strapi data layer, TypeScript types, site resolver, and build-time registries.
- `packages/ui`
  Shared layouts, page components, Dynamic Zone sections, UI primitives, and SEO/media helpers.
- `packages/theme`
  Shared theme tokens and Tailwind presets.
- `packages/config`
  Shared config support such as Tailwind preset plumbing.

## Root Scripts

At the monorepo root:

- `pnpm dev`
  Runs `turbo dev`
- `pnpm build`
  Runs `turbo build`
- `pnpm lint`
  Runs `turbo lint`

Turbo build env assumptions:

- `STRAPI_URL`
- `SITE_SLUG`
- `SITE_URL`

## Current Apps

- `apps/proneofishing`
- `apps/proneohunting`

Each app has:

- `astro.config.mjs`
- `package.json`
- `tailwind.config.mjs`
- `vercel.json`
- `src/tokens.css`
- `src/pages/*`

## Route Matrix

Current route families exist in both apps:

- `index.astro`
- `[...slug].astro`
- `products/[slug].astro`
- `categories/[slug].astro`
- `blog/[slug].astro`
- `news/[slug].astro`
- `tags/[slug].astro`
- `keyword-clusters/[slug].astro`
- `faq/[...slug].astro`
- `author/[slug].astro`
- `robots.txt.ts`

Treat route parity across apps as the default unless the user asks for site-specific divergence.

## Shared Package Responsibilities

### `packages/cms`

Main files:

- `src/client.ts`
- `src/types.ts`
- `src/site-resolver.ts`
- `src/link-index.ts`
- `src/sitemap-exclude.ts`
- `src/index.ts`

Role:

- talk to Strapi
- apply Site slug filtering
- expose shared content types
- support build-time link and sitemap utilities

### `packages/ui`

Main folders:

- `src/components/layout`
- `src/components/pages`
- `src/components/sections`
- `src/components/ui`
- `src/components/blocks`
- `src/lib`

Role:

- own layout shell and page rendering
- render Dynamic Zone sections
- provide reusable UI pieces
- centralize SEO, schema, and media helpers

### `packages/theme`

Role:

- own CSS tokens and Tailwind presets
- allow multiple branded sites to share the same component code

## Build and Deploy Shape

- Output mode is static.
- Vercel config builds from the monorepo root and filters to the target app.
- App `vercel.json` currently runs monorepo-aware commands like:
  `pnpm exec turbo build --filter=<app-name>`

This means app-level changes can still be affected by shared-package breakage.

## Working Boundaries

- Run frontend commands from `D:\www\b2bcms\astro_site`.
- Keep Astro and Strapi repo states mentally separate.
- Do not store secrets from `.env.local` or Vercel config in skill docs.
