/**
 * MenuItem lifecycle hooks.
 *
 * - afterUpdate: traces Menu → Site to find build_webhook and logs it.
 */

import { logBuildWebhook } from '../../../shared/webhook'

export default {
  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (!documentId) return

    try {
      const entry = await strapi
        .documents('api::menu-item.menu-item')
        .findOne({
          documentId,
          populate: {
            menu: {
              populate: ['site'],
            },
          },
        })

      const site = (entry?.menu as any)?.site
      if (site?.build_webhook) {
        strapi.log.info(
          `[Webhook] Would call: ${site.build_webhook} | ` +
          `entry=api::menu-item.menu-item::${documentId} | ` +
          `site=${site.name || site.slug}`
        )
      } else {
        strapi.log.info(
          `[Webhook] No build_webhook configured for api::menu-item.menu-item::${documentId}`
        )
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      strapi.log.error(`[MenuItem Lifecycle] ${message}`)
    }
  },
}
