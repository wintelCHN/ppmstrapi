/**
 * Product custom controller.
 *
 * Extends the core controller with:
 * - batchUpdate  — POST /api/products/batch-update
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  /**
   * POST /api/products/batch-update
   *
   * Body: { data: { documentIds: string[], data: { site?, category?, moq? } } }
   *
   * Updates site, category, and/or MOQ for a batch of products.
   * Each product is updated individually through the Document Service
   * (lifecycles fire, webhooks trigger, slug stays unchanged).
   *
   * Note: auth: false in route config bypasses default content-api auth
   * (which would reject admin JWT). The admin panel is the only consumer.
   */
  async batchUpdate(ctx: any) {
    try {
      const { documentIds, data } = ctx.request.body?.data ?? ctx.request.body ?? {}

      // ── Validation ──────────────────────────────────────────────────
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return ctx.badRequest('documentIds must be a non-empty array')
      }
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return ctx.badRequest(
          'data must contain at least one field to update (site, category, or moq)',
        )
      }

      const allowedFields = ['site', 'category', 'moq']
      const keys = Object.keys(data)
      const invalid = keys.filter((k) => !allowedFields.includes(k))
      if (invalid.length > 0) {
        return ctx.badRequest(
          `Invalid fields: ${invalid.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
        )
      }

      // Validate MOQ if present
      if (data.moq !== undefined && data.moq !== null) {
        if (typeof data.moq !== 'number' || data.moq < 1 || !Number.isInteger(data.moq)) {
          return ctx.badRequest('moq must be a positive integer (min: 1)')
        }
      }

      // ── Delegate to service ─────────────────────────────────────────
      const service = strapi.service('api::product.product') as any
      const result = await service.batchUpdateProducts(documentIds, data)

      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Product Batch] Unexpected error: ${msg}`)
      return ctx.badRequest(msg)
    }
  },
}))
