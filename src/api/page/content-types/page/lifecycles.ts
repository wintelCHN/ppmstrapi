/**
 * Page content-type lifecycles.
 * Triggers build webhook on the associated Site after update.
 */

import { logBuildWebhook } from '../../../shared/webhook'

export default {
  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      await logBuildWebhook(strapi, 'api::page.page', documentId)
    }
  },
}
