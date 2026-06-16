/**
 * Product content-type lifecycles.
 *
 * Logs the associated Site's build_webhook after update.
 * Product reaches its Site via category → site (no direct site field).
 * Actual HTTP dispatch is deferred to Phase 4 — currently log-only,
 * consistent with all other content-type lifecycles.
 */

export default {
  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (!documentId) return

    try {
      const product = await strapi.documents('api::product.product').findOne({
        documentId,
        populate: ['category', 'category.site'],
      })

      if (!product) {
        strapi.log.warn(`[Product Webhook] Product not found: ${documentId}`)
        return
      }

      const category = (product as Record<string, unknown>).category as Record<string, unknown> | null
      const site = category?.site as Record<string, unknown> | null

      if (!site?.build_webhook) {
        strapi.log.info(
          `[Product Webhook] No build_webhook for product documentId=${documentId} | site=${site?.name ?? 'unknown'}`,
        )
        return
      }

      strapi.log.info(
        `[Product Webhook] Would call: ${site.build_webhook} | entry=api::product.product::${documentId} | site=${site.name}`,
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      strapi.log.error(`[Product Webhook] Failed for ${documentId}: ${message}`)
    }
  },
}
