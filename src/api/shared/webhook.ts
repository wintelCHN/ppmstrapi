/**
 * Shared webhook utility.
 *
 * Centralizes build-trigger logic used by content-type lifecycles.
 * When a content entry is updated, the associated Site's build_webhook URL
 * is read and logged. Actual HTTP dispatch is deferred to a future phase.
 */

interface SiteRelation {
  build_webhook: string | null
  name: string
}

export async function logBuildWebhook(
  strapi: any,
  uid: string,
  documentId: string,
): Promise<void> {
  try {
    const entry = await strapi.documents(uid).findOne({
      documentId,
      populate: ['site'],
    })

    if (!entry) {
      strapi.log.warn(`[Webhook] Entry not found: ${uid}::${documentId}`)
      return
    }

    const site = (entry as Record<string, unknown>).site as SiteRelation | null

    if (!site?.build_webhook) {
      strapi.log.info(
        `[Webhook] No build_webhook configured for ${uid}::${documentId} | site=${site?.name ?? 'unknown'}`,
      )
      return
    }

    strapi.log.info(
      `[Webhook] Would call: ${site.build_webhook} | entry=${uid}::${documentId} | site=${site.name}`,
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    strapi.log.error(`[Webhook] Failed for ${uid}::${documentId}: ${message}`)
  }
}
