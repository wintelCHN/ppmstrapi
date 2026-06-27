/**
 * News content-type lifecycles.
 *
 * - beforeUpdate: Syncs custom `status` field with Strapi's built-in
 *   Draft & Publish (`publishedAt`).
 * - afterUpdate:  Triggers build webhook on the associated Site.
 */

import { logBuildWebhook } from '../../../shared/webhook'
import { ensureMetadataPriority } from '../../../shared/metadata'

export default {
  async beforeCreate(event: any) {
    const { data } = event.params
    ensureMetadataPriority(data, 0.5)
  },

  async beforeUpdate(event: any) {
    const { data } = event.params
    ensureMetadataPriority(data, 0.5)
    if (Object.prototype.hasOwnProperty.call(data, 'publishedAt')) {
      data.status = data.publishedAt === null ? 'draft' : 'published'
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      logBuildWebhook(strapi, 'api::news.news', documentId)
    }
  },
}
