/**
 * Category content-type lifecycles.
 *
 * - beforeCreate: ensures slug is auto-generated from name
 *   (falls back when UID type fails with i18n localized names).
 * - beforeUpdate: re-generates slug if name changed and slug is empty.
 */

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
  const base = slugify(name) || 'category'
  let slug = base
  let counter = 2

  while (true) {
    const existing: any[] = await strapi
      .documents('api::category.category')
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

/** Extract name string from either i18n object or plain string. */
function extractName(data: any): string {
  if (!data.name) return ''
  if (typeof data.name === 'string') return data.name
  if (typeof data.name === 'object') {
    return data.name.en || Object.values(data.name)[0] || ''
  }
  return ''
}

// ── lifecycles ───────────────────────────────────────────────────────────────

export default {
  async beforeCreate(event: any) {
    const { data } = event.params

    // Only generate if slug was not auto-filled by the UID type
    if (!data.slug || data.slug === '') {
      const name = extractName(data)
      if (name) {
        try {
          data.slug = await generateUniqueSlug(strapi, name)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          strapi.log.error(`[Category Slug] Generation error: ${msg}`)
        }
      }
    }
  },

  async beforeUpdate(event: any) {
    const { data, where } = event.params

    // Re-generate slug if name changed and slug is empty
    if (data.name) {
      const name = extractName(data)
      if (name && (!data.slug || data.slug === '')) {
        try {
          data.slug = await generateUniqueSlug(
            strapi,
            name,
            where?.documentId,
          )
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          strapi.log.error(`[Category Slug] Update error: ${msg}`)
        }
      }
    }
  },
}
