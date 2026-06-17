/**
 * Product content-type lifecycles.
 *
 * - beforeCreate: auto-generates SKU (PPN-XXXXXX) via PostgreSQL sequence,
 *                 auto-generates slug from name with duplicate suffix (-2, -3, …).
 * - beforeUpdate: re-generates slug if name changed,
 *                 copies localized fields from EN when adding a new locale.
 * - afterUpdate:  triggers build webhook via shared logBuildWebhook utility.
 */

import { logBuildWebhook } from '../../../shared/webhook'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Fields that require translation — auto-copied from EN when adding a new locale. */
const LOCALIZED_FIELDS = [
  'name',
  'short_description',
  'Specification',
  'description',
  'seo_title',
  'seo_description',
  'seo_keywords',
]

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
  const base = slugify(name) || 'product'
  let slug = base
  let counter = 2

  while (true) {
    const existing: any[] = await strapi.documents('api::product.product').findMany({
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

async function generateSku(strapi: any): Promise<string> {
  const result: any = await strapi.db.connection.raw(
    "SELECT nextval('product_sku_seq') AS nextval",
  )
  const num = parseInt(result.rows[0].nextval, 10)
  return `PPN-${String(num).padStart(6, '0')}`
}

/**
 * When creating/updating a non-English locale, copy localized fields
 * from the English version if the new locale's fields are empty.
 */
async function copyLocalizedFromEn(
  strapi: any,
  data: any,
  documentId: string,
): Promise<void> {
  const locale = data.locale
  if (!locale || locale === 'en') return
  if (!documentId) return

  try {
    // Use strapi.db.query() (raw ORM) — NOT strapi.documents() which applies
    // document-service locale filtering that interferes with cross-locale queries.
    const allLocales: any[] = await strapi.db
      .query('api::product.product')
      .findMany({
        where: { documentId },
        orderBy: { publishedAt: 'desc' },
      })

    const enProduct =
      allLocales.find((r: any) => r.locale === 'en') ??
      allLocales[0] ??
      null

    if (!enProduct) {
      strapi.log.info(
        `[Product i18n] No EN version found for documentId=${documentId} — nothing to copy`,
      )
      return
    }

    strapi.log.info(
      `[Product i18n] Copying ${LOCALIZED_FIELDS.length} fields from EN → ${locale} | documentId=${documentId}`,
    )

    for (const field of LOCALIZED_FIELDS) {
      if (isEmpty(data[field]) && hasValue(enProduct[field])) {
        data[field] = enProduct[field]
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    strapi.log.warn(`[Product i18n] Could not copy fields from EN: ${msg}`)
  }
}

function isEmpty(value: any): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function hasValue(value: any): boolean {
  return !isEmpty(value)
}

// ── lifecycles ───────────────────────────────────────────────────────────────

export default {
  async beforeCreate(event: any) {
    const { data } = event.params

    // 1. Auto-generate SKU via PostgreSQL sequence
    try {
      data.sku = await generateSku(strapi)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Product SKU] Sequence error: ${msg}`)
      throw err
    }

    // 2. Auto-generate slug from name
    try {
      const name: string =
        (typeof data.name === 'object' && data.name !== null
          ? (data.name as Record<string, string>).en
          : undefined) ??
        (typeof data.name === 'string' ? data.name : data.name?.en) ??
        ''
      if (name) {
        data.slug = await generateUniqueSlug(strapi, name)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Product Slug] Generation error: ${msg}`)
    }

    // 3. Copy localized fields from EN when adding a new locale (rare edge-case)
    await copyLocalizedFromEn(strapi, data, data.documentId)
  },

  async beforeUpdate(event: any) {
    const { data, where } = event.params
    const documentId = where?.documentId

    // 1. Re-generate slug only if name is explicitly being changed
    if (data.name && documentId) {
      try {
        const name: string =
          typeof data.name === 'object' && data.name !== null
            ? (data.name as Record<string, string>).en ||
              Object.values(data.name as Record<string, string>)[0]
            : typeof data.name === 'string'
              ? data.name
              : ''
        if (name) {
          data.slug = await generateUniqueSlug(strapi, name, documentId)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        strapi.log.error(`[Product Slug] Update error: ${msg}`)
      }
    }

    // 2. Copy localized fields from EN when adding a new locale
    //    (This is the primary path — Strapi admin triggers beforeUpdate
    //     when saving a new locale for an existing document.)
    if (documentId) {
      await copyLocalizedFromEn(strapi, data, documentId)
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      await logBuildWebhook(strapi, 'api::product.product', documentId)
    }
  },
}
