/**
 * FAQ content-type lifecycles.
 *
 * - beforeUpdate: Syncs custom `status` field with Strapi's built-in
 *   Draft & Publish (`publishedAt`).
 * - afterUpdate:  Triggers build webhook on the associated Site.
 */

import { logBuildWebhook } from '../../../shared/webhook'

export default {
  async beforeUpdate(event: any) {
    const { data } = event.params
    if (Object.prototype.hasOwnProperty.call(data, 'publishedAt')) {
      data.status = data.publishedAt === null ? 'draft' : 'published'
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      logBuildWebhook(strapi, 'api::faq.faq', documentId)
    }
  },
}
