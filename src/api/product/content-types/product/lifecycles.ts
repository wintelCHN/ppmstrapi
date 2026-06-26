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

    // Copy metadata component from EN when empty
    const hasMetadata = data.metadata && (
      hasValue(data.metadata.metaTitle) || hasValue(data.metadata.metaDescription)
    )
    if (!hasMetadata && enProduct.id) {
      try {
        const enWithMeta = await strapi.documents('api::product.product').findOne({
          documentId,
          locale: 'en',
          populate: ['metadata'],
        })
        if (enWithMeta?.metadata) {
          data.metadata = {
            metaTitle: enWithMeta.metadata.metaTitle ?? '',
            metaDescription: enWithMeta.metadata.metaDescription ?? '',
            metaKeywords: (enWithMeta.metadata as any).metaKeywords ?? '',
            shareImage: enWithMeta.metadata.shareImage ?? null,
            twitterCardType: enWithMeta.metadata.twitterCardType ?? 'summary',
            twitterUsername: enWithMeta.metadata.twitterUsername ?? '',
          }
        }
      } catch (metaErr: unknown) {
        const msg = metaErr instanceof Error ? metaErr.message : String(metaErr)
        strapi.log.warn(`[Product i18n] Could not copy metadata from EN: ${msg}`)
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    strapi.log.warn(`[Product i18n] Could not copy fields from EN: ${msg}`)
  }
}

// ── Tag migration bridge (temporary — removed in cleanup phase) ──────────────

/**
 * Reads legacy `tags_json_deprecated` JSON string array, finds or creates
 * corresponding Tag documents, and returns an array of { documentId } objects
 * suitable for assigning to the new `tags` M:N relation.
 */
async function resolveTagsFromLegacy(
  strapi: any,
  tagNames: string[],
  siteDocumentId?: string,
): Promise<{ documentId: string }[]> {
  const resolved: { documentId: string }[] = []

  for (const name of tagNames) {
    if (!name || typeof name !== 'string' || !name.trim()) continue
    const normalized = name.trim()

    try {
      // Case-insensitive find — tag name is NOT localized, direct string search
      const existing: any[] = await strapi.documents('api::tag.tag').findMany({
        filters: { name: normalized },
        limit: 1,
      })

      let tag: any = null

      if (existing.length > 0) {
        tag = existing[0]
      } else {
        tag = await strapi.documents('api::tag.tag').create({
          data: {
            name: normalized,
            tagtype: 'product_type',
            ...(siteDocumentId ? { site: { documentId: siteDocumentId } } : {}),
          },
        })
        strapi.log.info(
          `[Product→Tag Migration] Auto-created tag: "${normalized}"`,
        )
      }

      if (!resolved.find((r) => r.documentId === tag.documentId)) {
        resolved.push({ documentId: tag.documentId })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.warn(
        `[Product→Tag Migration] Failed to resolve tag "${normalized}": ${msg}`,
      )
    }
  }

  return resolved
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

    // 4. Tag migration bridge: resolve legacy JSON tags → Tag documents
    if (Array.isArray(data.tags_json_deprecated) && data.tags_json_deprecated.length > 0) {
      const siteDocumentId =
        data.site?.documentId ??
        (typeof data.site === 'string' ? data.site : undefined)
      const resolved = await resolveTagsFromLegacy(
        strapi,
        data.tags_json_deprecated,
        siteDocumentId,
      )
      if (resolved.length > 0) {
        data.tags = resolved
      }
    }
  },

  async beforeUpdate(event: any) {
    const { data, where } = event.params
    const documentId = where?.documentId

    // 0. Sync custom `status` with built-in Draft & Publish (publishedAt)
    if (Object.prototype.hasOwnProperty.call(data, 'publishedAt')) {
      data.status = data.publishedAt === null ? 'draft' : 'published'
    }

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

    // 3. Tag migration bridge: resolve legacy JSON tags → Tag documents
    if (Array.isArray(data.tags_json_deprecated) && data.tags_json_deprecated.length > 0) {
      const siteDocumentId =
        data.site?.documentId ??
        (typeof data.site === 'string' ? data.site : undefined)
      const resolved = await resolveTagsFromLegacy(
        strapi,
        data.tags_json_deprecated,
        siteDocumentId,
      )
      if (resolved.length > 0) {
        data.tags = resolved
      }
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      await logBuildWebhook(strapi, 'api::product.product', documentId)
    }
  },
}
