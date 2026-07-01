---
name: astro-b2b-multisite
description: Astro monorepo skill for this B2B multi-site frontend at D:\www\b2b_frontend. Use when working on shared frontend packages, multi-app routing, packages/cms data access, packages/ui layouts and sections, Site slug filtering, SEO and JSON-LD output, Dynamic Zone rendering, theme integration, Vercel build rules, or Astro SSG behavior for this project.
---

# Astro B2B Multisite

This skill captures the project-specific frontend rules for the Astro multi-site monorepo in this workspace. Use it to avoid re-discovering how `apps/*`, `packages/cms`, `packages/ui`, `packages/theme`, Site filtering, SEO, Dynamic Zone rendering, and Vercel builds are wired together.

## Quick Start

1. Confirm the task is in `D:\www\b2b_frontend`, not the Strapi root.
2. Read `git status --short` inside `b2b_frontend` before editing.
3. Read only the relevant reference file:
   - Read [references/monorepo-map.md](D:/www/b2bcms/.agents/skills/astro-b2b-multisite/references/monorepo-map.md) for workspace layout, app/package ownership, route matrix, and deployment shape.
   - Read [references/frontend-rules.md](D:/www/b2bcms/.agents/skills/astro-b2b-multisite/references/frontend-rules.md) for data access, Site filter rules, SEO/SSG behavior, Dynamic Zone mapping, theme integration, and validation steps.
4. Inspect the exact package or app files before changing behavior.
5. Validate Astro changes from `D:\www\b2b_frontend` with `pnpm build` or the relevant app/package build command.

## Default Workflow

### Shared data-layer work

- Start in `packages/cms`.
- Check whether the task touches `client.ts`, `types.ts`, `site-resolver.ts`, `link-index.ts`, or `sitemap-exclude.ts`.
- Preserve the current Site-aware fetch pattern unless the user explicitly wants an architectural change.

### Shared UI or page-layout work

- Start in `packages/ui`.
- Check whether the change belongs to `layout`, `pages`, `sections`, `ui`, `blocks`, or `lib`.
- For Dynamic Zone work, always update both the type layer and the section registry.

### App-level work

- Keep app code thin. App pages should mainly assemble data, route params, and shared components.
- When adding a new page type, check both existing apps and keep them aligned unless the task is intentionally site-specific.

### Build, SEO, or deployment work

- Check `astro.config.mjs`, `vercel.json`, `robots.txt.ts`, and shared SEO helpers before changing output behavior.
- Remember that this project is SSG-first and tries to keep client JS minimal.

## Project Rules

- Strapi is the only business-content source. Do not hardcode real content into Astro pages.
- Keep the monorepo split clear:
  - `packages/cms` handles Strapi fetches, types, site resolution, and build-time registries.
  - `packages/ui` handles layouts, sections, page components, and UI primitives.
  - `packages/theme` handles design tokens and presets.
  - `apps/*` handle route entrypoints and site-specific config.
- Preserve the multi-site architecture: one shared codebase, multiple deployable apps.
- Prefer `.astro` components and native HTML/CSS for non-interactive UI. Keep JS light unless the feature truly needs it.

## Task Routing

- For monorepo ownership, package boundaries, route coverage, or deployment structure, read `references/monorepo-map.md` first.
- For `packages/cms`, Site filter behavior, SEO, Dynamic Zone, theme, SSG, or Vercel build rules, read `references/frontend-rules.md` first.
- For broad new frontend work that spans multiple packages, read both references first.

## Validation

- Run `pnpm build` from `D:\www\b2b_frontend` after shared frontend changes when feasible.
- For app-specific work, validate at least the affected app build.
- For route, SEO, or sitemap work, verify generated output behavior rather than relying only on type checks.
- For data-shape changes, sanity-check the matching Strapi contracts in `packages/cms/src/types.ts`.

## Do Not Forget

- The docs describe the intended architecture, but current code is the final source of truth when they differ.
- `packages/cms/src/client.ts` is a lightweight project wrapper around fetch, not a generic SDK. Preserve its local conventions unless intentionally refactoring.
- Dynamic Zone support is spread across Strapi schema, `packages/cms/src/types.ts`, `packages/ui/src/components/sections/*`, and `packages/ui/src/components/ui/DynamicZone.astro`.
- This repo has its own `.git` and dirty state separate from the Strapi root.
