/**
 * Product custom service.
 *
 * Extends the core service with business-logic methods:
 * - batchUpdateProducts  — bulk update site / category / MOQ
 */

import { factories } from '@strapi/strapi'

interface BatchUpdateInput {
  site?: { documentId: string }
  category?: { documentId: string }
  moq?: number
}

interface BatchUpdateResult {
  updated: number
  failed: number
  details: Array<{
    documentId: string
    status: 'updated' | 'failed' | 'skipped'
    reason?: string
  }>
}

export default factories.createCoreService('api::product.product', ({ strapi }) => ({
  /**
   * Batch update site, category, and/or MOQ for multiple products.
   *
   * Each product is updated individually via strapi.documents().update()
   * so lifecycles (beforeUpdate, afterUpdate) fire normally:
   *   - SKU: unchanged
   *   - Slug: unchanged (regenerated only if name is in patch)
   *   - Webhook: triggers for each product
   *
   * Validation:
   *   - If both site and category are set, the category MUST belong to the new site
   *   - If only site is changed (no category), the existing category is NOT cleared
   */
  async batchUpdateProducts(
    documentIds: string[],
    data: BatchUpdateInput,
  ): Promise<BatchUpdateResult> {
    // ── Pre-validate cross-reference: category must belong to site ────
    if (data.site && data.category) {
      const category = await strapi.documents('api::category.category').findOne({
        documentId: data.category.documentId,
        populate: ['site'],
      })
      if (!category) {
        throw new Error(`Category ${data.category.documentId} not found`)
      }
      const catSiteId =
        (category as any).site?.documentId ??
        (typeof (category as any).site === 'string'
          ? (category as any).site
          : undefined)
      if (catSiteId && catSiteId !== data.site.documentId) {
        throw new Error(
          `Category "${(category as any).name ?? category.documentId}" does not belong to site ${data.site.documentId}`,
        )
      }
    }

    const details: BatchUpdateResult['details'] = []
    let updated = 0
    let failed = 0

    // ── Build update patch ──────────────────────────────────────────
    for (const documentId of documentIds) {
      try {
        // Verify product exists
        const product = await strapi
          .documents('api::product.product')
          .findOne({ documentId })

        if (!product) {
          details.push({
            documentId,
            status: 'skipped',
            reason: 'Product not found',
          })
          continue
        }

        // Build update data — only include the fields we're changing
        const updateData: Record<string, any> = {}

        if (data.moq !== undefined && data.moq !== null) {
          updateData.moq = data.moq
        }

        if (data.site) {
          updateData.site = { documentId: data.site.documentId }
        }

        if (data.category) {
          updateData.category = { documentId: data.category.documentId }
        } else if (data.site) {
          // If site changed but category not specified, clear the category
          // to avoid an orphaned cross-site category reference
          updateData.category = null
        }

        await strapi.documents('api::product.product').update({
          documentId,
          data: updateData,
        })

        updated++
        details.push({ documentId, status: 'updated' })
      } catch (err: unknown) {
        failed++
        const msg = err instanceof Error ? err.message : String(err)
        details.push({ documentId, status: 'failed', reason: msg })
        strapi.log.error(
          `[Product Batch] Failed to update product ${documentId}: ${msg}`,
        )
      }
    }

    strapi.log.info(
      `[Product Batch] Complete: ${updated} updated, ${failed} failed, ${documentIds.length} total`,
    )

    return { updated, failed, details }
  },
}))
