# Strapi Rules

## Strapi 5 Data and API Rules

- Expect flattened API responses, not Strapi 4 `attributes`.
- Use `documentId` for document-level flows.
- Do not rely on `populate=deep`; use explicit populate or `populate=*` where appropriate.
- Collection APIs paginate by default; account for pagination in full-sync or build tasks.
- Pass `locale` for i18n reads and writes when the task depends on locale-specific data.

## Publish and Visibility Rules

- Draft & Publish still matters: production content generally needs `publishedAt != null`.
- Business visibility may also depend on custom `status`.
- Product visibility typically requires published content plus `status = published`, excluding archived items.
- Site visibility also depends on `is_published`.

## Custom Endpoint Pattern

Strapi 5 CE admin-only custom content-api routes in this project do not rely on `type: 'admin'` or API-level policies.

Use this local pattern:

- Route config: `auth: false`, `policies: []`
- Controller: verify Bearer token inline
- Accepted auth modes for Product custom endpoints:
  - Admin JWT
  - Strapi API Token
  - Shared secret fallback

Reference files:

- [src/api/product/routes/product.ts](D:/www/b2bcms/src/api/product/routes/product.ts)
- [src/api/product/controllers/product.ts](D:/www/b2bcms/src/api/product/controllers/product.ts)

Important:

- `useFetchClient` in the admin already wraps responses in `{ data }`.
- Do not add a second redundant `{ data: result }` layer for admin-targeted custom controller responses unless the existing caller expects it.

## Lifecycle Rules

Shared lifecycle pattern:

- `beforeCreate` and `beforeUpdate` enforce normalization and cross-field sync.
- `afterUpdate` triggers site rebuild webhooks for content tied to a Site.
- There is no dependable `afterPublish` shortcut in this project flow; publish events are covered through `afterUpdate`.

Product lifecycle currently handles:

- SKU generation via PostgreSQL sequence
- Slug auto-generation and de-duplication
- `publishedAt` to `status` sync
- localized field copy from EN into new locales
- metadata priority defaulting
- temporary legacy-tag bridge
- webhook dispatch on update

Reference files:

- [src/api/product/content-types/product/lifecycles.ts](D:/www/b2bcms/src/api/product/content-types/product/lifecycles.ts)
- [src/api/shared/webhook.ts](D:/www/b2bcms/src/api/shared/webhook.ts)

## Product and n8n Rules

`POST /api/products/create-with-images` is a critical integration surface.

Supported image input modes:

- `imageBase64`
  Recommended. n8n downloads the image upstream and sends base64 payloads.
- `imageUrls`
  Legacy. Server downloads public URLs and may hit CDN blocking.
- multipart upload
  Legacy direct file upload mode.

Important Product integration rules:

- De-duplicate by `source_url` before creating a new product.
- Duplicate requests return `200` with `_skipped: true`.
- Normalize legacy flat SEO fields into `metadata`.
- Default `product_schema.brand` to `PRONEO` when missing.
- Upload images through the Strapi upload plugin so local or R2 storage stays consistent.

Reference files:

- [src/api/product/controllers/product.ts](D:/www/b2bcms/src/api/product/controllers/product.ts)
- [src/api/product/services/product.ts](D:/www/b2bcms/src/api/product/services/product.ts)

## Lead Center Rules

Lead is a public write surface and should stay defensive.

Current behavior:

- Public submit route: `POST /api/public/lead`
- Honeypot spam check returns fake `200` success
- In-memory rate limit check blocks burst abuse
- IP and user-agent are captured automatically
- notification email is fire-and-forget
- CSV export exists for admin use

Reference files:

- [src/api/lead/routes/lead.ts](D:/www/b2bcms/src/api/lead/routes/lead.ts)
- [src/api/lead/controllers/lead.ts](D:/www/b2bcms/src/api/lead/controllers/lead.ts)
- [src/api/lead/services/lead.ts](D:/www/b2bcms/src/api/lead/services/lead.ts)

## R2 and Upload Rules

This project uses `@strapi/provider-upload-aws-s3` to talk to Cloudflare R2.

Key points:

- Provider switch is controlled by `UPLOAD_PROVIDER`.
- Production media uses Cloudflare R2 through S3-compatible settings.
- Returned URLs may already be absolute CDN URLs; frontend helpers should pass them through.
- Size limits are set in both plugin config and request body middleware.
- CSP must allow the CDN domain for `img-src` and `media-src` or admin previews will fail.

Reference files:

- [config/plugins.ts](D:/www/b2bcms/config/plugins.ts)
- [config/middlewares.ts](D:/www/b2bcms/config/middlewares.ts)
- [scripts/migrate-to-r2.js](D:/www/b2bcms/scripts/migrate-to-r2.js)

## Railway and Runtime Notes

- Railway production should avoid depending on local filesystem persistence.
- Keep upload behavior externalized to R2 for durable media.
- Watch request-size and timeout ceilings when adding media flows.
- Sequence initialization happens in `prestart` through `scripts/ensure-sequences.js`.

Reference files:

- [scripts/ensure-sequences.js](D:/www/b2bcms/scripts/ensure-sequences.js)
- [scripts/check-sequence.js](D:/www/b2bcms/scripts/check-sequence.js)

## Admin UI Rules

- Put admin UI changes under `src/admin/`.
- Prefer scoped DOM or extension-based customization over editing `node_modules`.
- Product media preview customizations currently live in [src/admin/app.tsx](D:/www/b2bcms/src/admin/app.tsx).

## Validation Checklist

- Run `npm run build` after Strapi changes.
- For schema changes, inspect related lifecycle, controller, service, and frontend contract files.
- For public endpoints, check auth expectations, payload shape, and rate-limit/spam behavior.
- For Product changes, think through webhook, ingestion, media, and Astro rendering effects.
- For R2 or upload changes, verify both upload success and admin preview behavior.
