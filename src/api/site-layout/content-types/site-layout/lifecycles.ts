/**
 * SiteLayout lifecycle hooks.
 *
 * - beforeCreate: enforces one-to-one with Site (no duplicate layouts per site).
 * - afterUpdate: logs build webhook from the associated Site.
 */

import { logBuildWebhook } from '../../../shared/webhook'

export default {
  async beforeCreate(event: any) {
    const siteDocumentId = event?.params?.data?.site?.documentId
    if (!siteDocumentId) return

    const existing = await strapi
      .documents('api::site-layout.site-layout')
      .findFirst({
        filters: {
          site: { documentId: siteDocumentId },
        },
      })

    if (existing) {
      throw new Error('Each Site can only have one SiteLayout.')
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      logBuildWebhook(strapi, 'api::site-layout.site-layout', documentId)
    }
  },
}
