---
name: strapi-b2b-cms
description: Strapi 5 project skill for this B2B CMS workspace. Use when working on the backend at D:\www\b2bcms, especially for content-type schema changes, lifecycles, custom controllers/routes, Strapi Admin customizations, Product or Lead flows, Cloudflare R2 upload behavior, Railway deployment constraints, n8n ingestion endpoints, or when checking Strapi 5 project-specific pitfalls and validation steps.
---

# Strapi B2B CMS

This skill captures the project-specific rules for the Strapi backend in this workspace. Use it to avoid re-discovering local conventions around content models, public/admin endpoints, Product ingestion, Lead Center behavior, R2 storage, Railway constraints, and Strapi 5 edge cases.

## Quick Start

1. Confirm the task stays inside `D:\www\b2bcms` and not `astro_site/`.
2. Read `git status --short` before editing and work around unrelated dirty files.
3. Read only the relevant reference file for the task:
   - Read [references/project-map.md](D:/www/b2bcms/.agents/skills/strapi-b2b-cms/references/project-map.md) for repository boundaries, doc priority, content model map, and frontend coupling.
   - Read [references/strapi-rules.md](D:/www/b2bcms/.agents/skills/strapi-b2b-cms/references/strapi-rules.md) for lifecycle, controller, route, R2, Railway, webhook, Lead, Product, and validation rules.
4. Inspect the exact schema/controller/service/lifecycle/admin files before changing behavior.
5. Validate Strapi changes with `npm run build` from `D:\www\b2bcms`.

## Default Workflow

### Content model or schema work

- Read the content type schema and any related component schemas.
- Check whether the change affects i18n, draft/publish, relations, lifecycle logic, Public permissions, Astro API types, or sitemap/SEO output.
- For Product, Page, Blog, News, FAQ, Tag, Author, and SiteLayout, check existing lifecycle hooks before adding new behavior.

### Controller or route work

- Prefer the existing project pattern over Strapi defaults when custom endpoints already exist.
- For admin-only custom content-api endpoints in Strapi 5 CE, use the local project pattern:
  `config: { auth: false, policies: [] }` plus inline Bearer-token verification in the controller.
- Do not wrap custom controller results in an extra `{ data: ... }` when the Admin page uses `useFetchClient`.

### Media, upload, or R2 work

- Check both [config/plugins.ts](D:/www/b2bcms/config/plugins.ts) and [config/middlewares.ts](D:/www/b2bcms/config/middlewares.ts).
- Remember that Cloudflare R2 uses the AWS S3 provider path in this project.
- Check CSP and size-limit behavior when admin previews or uploads fail.

### Product or Lead workflow work

- Treat Product as the highest-risk model because it touches lifecycle logic, ingestion, media, webhook triggering, and Astro rendering.
- Treat Lead as a security-sensitive public surface: preserve honeypot, rate limit, and async notification behavior.

## Project Rules

- Keep Strapi as the only content source. Do not move business content into Astro.
- Use `documentId` for document-level addressing. Do not design new flows around numeric `id` for cross-API usage.
- Assume Strapi 5 flattened API responses and no `populate=deep`.
- Keep changes scoped. Avoid editing `node_modules` or broad admin overrides when a local `src/admin` customization works.
- Never copy secrets from `CLAUDE.md`, `.env`, or local config into skill files, docs, or commits.
- Treat `astro_site/` as a separate Git repo and separate runtime.

## Task Routing

- For lifecycle, publish-state, webhook, localized-field copy, or SKU/slug behavior, read `references/strapi-rules.md` first.
- For Product ingestion, R2 migration, create-with-images, or n8n integration, read `references/strapi-rules.md` first.
- For repository orientation, content model map, frontend coupling, or doc priority, read `references/project-map.md` first.
- For a brand-new task with unclear ownership, read both references before making changes.

## Validation

- Run `npm run build` after Strapi backend changes unless the task is read-only.
- For upload or admin UI work, confirm behavior in the local Strapi admin at `http://localhost:1339/admin` when feasible.
- For Product, Page, Blog, News, FAQ, Tag, SiteLayout, or Lead changes, sanity-check whether Astro contracts or public behavior are affected even if the code edit stays in Strapi.

## Do Not Forget

- Existing local docs can be stale in parts. When docs conflict, prefer current code plus the higher-priority docs listed in `references/project-map.md`.
- `CLAUDE.md` is useful for orientation but may contain sensitive values. Read it selectively and never reproduce secrets.
- Product media previews and other admin UI tweaks belong in [src/admin/app.tsx](D:/www/b2bcms/src/admin/app.tsx), not in `node_modules`.
