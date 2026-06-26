/**
 * Page content-type lifecycles.
 *
 * - beforeCreate: auto-generates slug from shortName (i18n-aware).
 * - beforeUpdate: re-generates slug if shortName changed,
 *                 syncs custom `status` with Strapi Draft & Publish.
 * - afterUpdate:  triggers build webhook on the associated Site.
 */

import { logBuildWebhook } from '../../../shared/webhook'

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

async function generateUniqueSlug(
  strapi: any,
  shortName: string,
  excludeDocumentId?: string,
): Promise<string> {
  const base = slugify(shortName) || 'page'
  let slug = base
  let counter = 2

  while (true) {
    const existing: any[] = await strapi
      .documents('api::page.page')
      .findMany({
        filters: { slug },
        limit: 1,
      })

    if (
      existing.length === 0 ||
      (excludeDocumentId && existing[0].documentId === excludeDocumentId)
    ) {
      return slug
    }

    slug = `${base}-${counter}`
    counter++
  }
}

/** Extract shortName string from either i18n object or plain string. */
function extractShortName(data: any): string {
  if (!data.shortName) return ''
  if (typeof data.shortName === 'string') return data.shortName
  // i18n object: { en: "Home", zh: "首页", ... }
  if (typeof data.shortName === 'object') {
    return data.shortName.en || Object.values(data.shortName)[0] || ''
  }
  return ''
}

// ── lifecycles ───────────────────────────────────────────────────────────────

export default {
  /** Auto-generate slug from shortName on create. */
  async beforeCreate(event: any) {
    const { data } = event.params

    const name = extractShortName(data)
    if (name) {
      try {
        // Only generate if slug is not explicitly provided
        if (!data.slug || data.slug === '') {
          data.slug = await generateUniqueSlug(strapi, name)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        strapi.log.error(`[Page Slug] Generation error: ${msg}`)
      }
    }
  },

  async beforeUpdate(event: any) {
    const { data, where } = event.params
    const documentId = where?.documentId

    // 1. Sync custom `status` with built-in Draft & Publish (publishedAt)
    if (Object.prototype.hasOwnProperty.call(data, 'publishedAt')) {
      if (data.publishedAt === null) {
        data.status = 'draft'
      } else {
        data.status = 'published'
      }
    }

    // 2. Re-generate slug if shortName changed
    if (data.shortName && documentId) {
      try {
        const name = extractShortName(data)
        if (name && (!data.slug || data.slug === '')) {
          data.slug = await generateUniqueSlug(strapi, name, documentId)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        strapi.log.error(`[Page Slug] Update error: ${msg}`)
      }
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      logBuildWebhook(strapi, 'api::page.page', documentId)
    }
  },
}
