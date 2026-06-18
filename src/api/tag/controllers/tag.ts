/**
 * Tag custom controller.
 *
 * Extends the core controller with custom actions:
 * - cloud              — GET  /api/tags/cloud
 * - findBySlug         — GET  /api/tags/by-slug/:slug
 * - products           — GET  /api/tags/:slug/products
 * - merge              — POST /api/tags/merge
 * - statistics         — GET  /api/tags/statistics
 * - suggestDuplicates  — GET  /api/tags/suggest-duplicates
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::tag.tag', ({ strapi }) => ({
  /**
   * GET /api/tags/cloud?site=xxx&tagtype=xxx
   * Returns tag cloud data with product counts.
   */
  async cloud(ctx: any) {
    try {
      const { site, tagtype } = ctx.query
      const service = strapi.service('api::tag.tag') as any
      const data = await service.getTagCloud(site, tagtype)
      return { data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return ctx.badRequest({ error: msg })
    }
  },

  /**
   * GET /api/tags/by-slug/:slug
   * Returns a single tag with SEO metadata, products, and related tags.
   */
  async findBySlug(ctx: any) {
    try {
      const { slug } = ctx.params
      const tag = await strapi.documents('api::tag.tag').findFirst({
        filters: { slug },
        populate: ['products', 'relatedtags'],
      })
      if (!tag) return ctx.notFound({ error: 'Tag not found' })
      return { data: tag }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return ctx.badRequest({ error: msg })
    }
  },

  /**
   * GET /api/tags/:slug/products?page=1&pageSize=20
   * Returns paginated products for a specific tag.
   */
  async products(ctx: any) {
    try {
      const { slug } = ctx.params
      const page = parseInt(ctx.query.page ?? '1', 10)
      const pageSize = parseInt(ctx.query.pageSize ?? '20', 10)
      const service = strapi.service('api::tag.tag') as any
      const data = await service.getProductsByTag(slug, page, pageSize)
      if (!data) return ctx.notFound({ error: 'Tag not found' })
      return { data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return ctx.badRequest({ error: msg })
    }
  },

  /**
   * POST /api/tags/merge
   * Body: { targetDocumentId, sourceDocumentIds[] }
   * Merges source tags into the target tag.
   */
  async merge(ctx: any) {
    try {
      const { targetDocumentId, sourceDocumentIds } =
        ctx.request.body?.data ?? ctx.request.body ?? {}
      if (
        !targetDocumentId ||
        !Array.isArray(sourceDocumentIds) ||
        sourceDocumentIds.length === 0
      ) {
        return ctx.badRequest({
          error: 'targetDocumentId and sourceDocumentIds (array) are required',
        })
      }
      if (sourceDocumentIds.includes(targetDocumentId)) {
        return ctx.badRequest({ error: 'Cannot merge a tag into itself' })
      }
      const service = strapi.service('api::tag.tag') as any
      const result = await service.mergeTags(targetDocumentId, sourceDocumentIds)
      return { data: result }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return ctx.badRequest({ error: msg })
    }
  },

  /**
   * GET /api/tags/statistics?site=xxx
   * Returns aggregate tag usage statistics.
   */
  async statistics(ctx: any) {
    try {
      const { site } = ctx.query
      const service = strapi.service('api::tag.tag') as any
      const data = await service.getStatistics(site)
      return { data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return ctx.badRequest({ error: msg })
    }
  },

  /**
   * GET /api/tags/suggest-duplicates?site=xxx
   * Returns groups of tags with identical normalized names.
   */
  async suggestDuplicates(ctx: any) {
    try {
      const { site } = ctx.query
      const service = strapi.service('api::tag.tag') as any
      const data = await service.suggestDuplicates(site)
      return { data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return ctx.badRequest({ error: msg })
    }
  },
}))
