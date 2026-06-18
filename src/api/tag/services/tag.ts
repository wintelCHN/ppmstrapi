/**
 * Tag custom service.
 *
 * Extends the core service with business-logic methods:
 * - getTagCloud      — tag list with product counts
 * - getProductsByTag — paginated products for a given tag slug
 * - mergeTags        — merge source tags into a target tag
 * - getStatistics    — aggregate usage statistics
 * - suggestDuplicates — find tags with identical normalized names
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreService('api::tag.tag', ({ strapi }) => ({
  /**
   * Get tag cloud data with product counts.
   * Optionally filtered by site and/or tagtype.
   */
  async getTagCloud(siteDocumentId?: string, tagtype?: string) {
    const filters: any = {}
    if (siteDocumentId) filters.site = { documentId: siteDocumentId }
    if (tagtype) filters.tagtype = tagtype

    const tags = await strapi.documents('api::tag.tag').findMany({
      filters,
      populate: ['products'],
      sort: 'name:asc',
    })

    return tags.map((t: any) => ({
      documentId: t.documentId,
      name: t.name,
      slug: t.slug,
      tagtype: t.tagtype,
      productCount: Array.isArray(t.products) ? t.products.length : 0,
      targetkeyword: t.targetkeyword,
    }))
  },

  /**
   * Get products for a specific tag by slug, with pagination.
   */
  async getProductsByTag(slug: string, page: number = 1, pageSize: number = 20) {
    const tag = await strapi.documents('api::tag.tag').findFirst({
      filters: { slug },
      populate: { products: { count: true } },
    })
    if (!tag) return null

    const offset = (page - 1) * pageSize
    const products = await strapi.documents('api::product.product').findMany({
      filters: {
        tags: { documentId: { $eq: (tag as any).documentId } },
        status: 'published',
      },
      limit: pageSize,
      start: offset,
      populate: ['images', 'category'],
    })

    return {
      tag,
      products,
      pagination: {
        page,
        pageSize,
        total: (tag as any).products?.count ?? 0,
      },
    }
  },

  /**
   * Merge source tags into a target tag.
   *
   * - Re-links all product relations from source tags to the target
   * - Merges relatedkeywords arrays without duplicates
   * - Merges relatedtags self-relations (both directions)
   * - Deletes source tags on success
   */
  async mergeTags(targetDocumentId: string, sourceDocumentIds: string[]) {
    const target = await strapi.documents('api::tag.tag').findOne({
      documentId: targetDocumentId,
      populate: ['products', 'relatedtags'],
    })

    if (!target) throw new Error(`Target tag ${targetDocumentId} not found`)

    const results: {
      sourceId: string
      sourceName: string
      productCount: number
      success: boolean
    }[] = []

    for (const sourceId of sourceDocumentIds) {
      try {
        const source = await strapi.documents('api::tag.tag').findOne({
          documentId: sourceId,
          populate: ['products', 'relatedtags'],
        })

        if (!source) {
          results.push({ sourceId, sourceName: '(not found)', productCount: 0, success: false })
          continue
        }

        const sourceName = (source as any).name
        const sourceProducts: any[] = (source as any).products ?? []
        const targetProducts: any[] = (target as any).products ?? []
        const targetProductIds = new Set(targetProducts.map((p: any) => p.documentId))
        const newProducts = sourceProducts.filter(
          (p: any) => !targetProductIds.has(p.documentId),
        )
        const mergedProducts = [
          ...targetProducts.map((p: any) => ({ documentId: p.documentId })),
          ...newProducts.map((p: any) => ({ documentId: p.documentId })),
        ]

        // Update target with merged products and keywords
        await strapi.documents('api::tag.tag').update({
          documentId: targetDocumentId,
          data: {
            products: mergedProducts,
            relatedkeywords: [
              ...new Set([
                ...((target as any).relatedkeywords ?? []),
                ...((source as any).relatedkeywords ?? []),
              ]),
            ],
          },
        })

        // Merge relatedtags self-relations (outgoing: source → others)
        const sourceRelated: any[] = (source as any).relatedtags ?? []
        const targetRelatedIds = new Set(
          ((target as any).relatedtags ?? []).map((r: any) => r.documentId),
        )
        const newRelated = sourceRelated.filter(
          (r: any) =>
            !targetRelatedIds.has(r.documentId) && r.documentId !== targetDocumentId,
        )
        if (newRelated.length > 0) {
          await strapi.documents('api::tag.tag').update({
            documentId: targetDocumentId,
            data: {
              relatedtags: [
                ...((target as any).relatedtags ?? []).map((r: any) => ({
                  documentId: r.documentId,
                })),
                ...newRelated.map((r: any) => ({ documentId: r.documentId })),
              ],
            },
          })
        }

        // Re-point incoming relations (others → source) to target
        const tagsPointingToSource = await strapi.documents('api::tag.tag').findMany({
          filters: { relatedtags: { documentId: sourceId } },
        })
        for (const tag of tagsPointingToSource) {
          const currentRelated: any[] = ((tag as any).relatedtags ?? [])
          const updatedRelated = currentRelated.map((r: any) =>
            r.documentId === sourceId ? { documentId: targetDocumentId } : r,
          )
          // Deduplicate: ensure target isn't already there
          const ids = new Set(updatedRelated.map((r: any) => r.documentId))
          await strapi.documents('api::tag.tag').update({
            documentId: (tag as any).documentId,
            data: {
              relatedtags: [...ids].map((id) => ({ documentId: id })),
            },
          })
        }

        // Delete source tag (cascades: Strapi removes it from all relations)
        await strapi.documents('api::tag.tag').delete({ documentId: sourceId })

        results.push({
          sourceId,
          sourceName,
          productCount: sourceProducts.length,
          success: true,
        })
        strapi.log.info(
          `[Tag Merge] Merged "${sourceName}" → "${(target as any).name}" | ${sourceProducts.length} products, ${tagsPointingToSource.length} reverse refs re-linked`,
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        strapi.log.error(`[Tag Merge] Failed merging ${sourceId}: ${msg}`)
        results.push({ sourceId, sourceName: '', productCount: 0, success: false })
      }
    }

    return { targetId: targetDocumentId, targetName: (target as any).name, results }
  },

  /**
   * Get aggregate usage statistics for all tags, optionally filtered by site.
   */
  async getStatistics(siteDocumentId?: string) {
    const filters: any = {}
    if (siteDocumentId) filters.site = { documentId: siteDocumentId }

    const tags = await strapi.documents('api::tag.tag').findMany({
      filters,
      populate: ['products'],
    })

    const totalTags = tags.length
    const totalProductLinks = tags.reduce(
      (sum: number, t: any) =>
        sum + (Array.isArray(t.products) ? t.products.length : 0),
      0,
    )
    const byType: Record<string, number> = {}
    for (const t of tags) {
      const tp = (t as any).tagtype ?? 'unknown'
      byType[tp] = (byType[tp] ?? 0) + 1
    }
    const orphanTags = tags.filter(
      (t: any) => !Array.isArray(t.products) || t.products.length === 0,
    ).length

    return {
      totalTags,
      totalProductLinks,
      byType,
      orphanTags,
      siteDocumentId: siteDocumentId ?? 'all',
    }
  },

  /**
   * Find tags with identical normalized names (case-insensitive).
   * Returns groups of duplicates for admin merge suggestions.
   */
  async suggestDuplicates(siteDocumentId?: string) {
    const filters: any = {}
    if (siteDocumentId) filters.site = { documentId: siteDocumentId }

    const tags = await strapi.documents('api::tag.tag').findMany({
      filters,
      sort: 'name:asc',
    })

    const normalized = new Map<string, any[]>()
    for (const t of tags) {
      const key = ((t as any).name ?? '').toLowerCase().trim()
      if (!normalized.has(key)) normalized.set(key, [])
      normalized.get(key)!.push(t)
    }

    const duplicates: { normalizedName: string; tags: any[] }[] = []
    for (const [key, group] of normalized) {
      if (group.length > 1) duplicates.push({ normalizedName: key, tags: group })
    }

    return duplicates
  },
}))
