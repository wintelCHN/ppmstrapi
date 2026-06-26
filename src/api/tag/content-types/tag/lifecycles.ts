/**
 * Tag content-type lifecycles.
 *
 * - beforeCreate: auto-generates slug from name with duplicate suffix (-2, -3, …).
 * - beforeUpdate: re-generates slug if name changed.
 * - afterUpdate:  triggers build webhook via shared logBuildWebhook utility.
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
  name: string,
  excludeDocumentId?: string,
): Promise<string> {
  const base = slugify(name) || 'tag'
  let slug = base
  let counter = 2

  while (true) {
    const existing: any[] = await strapi.documents('api::tag.tag').findMany({
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

function isEmpty(value: any): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

// ── lifecycles ───────────────────────────────────────────────────────────────

export default {
  async beforeCreate(event: any) {
    const { data } = event.params

    // 1. Auto-generate slug from name
    //    Since name is NOT localized, we can read it directly as a string.
    try {
      const name: string =
        typeof data.name === 'string' ? data.name : data.name ?? ''
      if (name) {
        data.slug = await generateUniqueSlug(strapi, name)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Tag Slug] Generation error: ${msg}`)
    }

    // 2. Default relatedkeywords to empty array
    if (isEmpty(data.relatedkeywords)) {
      data.relatedkeywords = []
    }
  },

  async beforeUpdate(event: any) {
    const { data, where } = event.params
    const documentId = where?.documentId

    // Re-generate slug only if name is explicitly being changed
    if (data.name && documentId) {
      try {
        const name: string =
          typeof data.name === 'string'
            ? data.name
            : data.name ?? ''
        if (name) {
          data.slug = await generateUniqueSlug(strapi, name, documentId)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        strapi.log.error(`[Tag Slug] Update error: ${msg}`)
      }
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      logBuildWebhook(strapi, 'api::tag.tag', documentId)
    }
  },
}
