/**
 * Page content-type lifecycles.
 *
 * - beforeUpdate: Syncs custom `status` field with Strapi's built-in
 *   Draft & Publish (`publishedAt`). When publishedAt is set, status
 *   becomes "published"; when cleared, status reverts to "draft".
 * - afterUpdate:  Triggers build webhook on the associated Site.
 */

import { logBuildWebhook } from '../../../shared/webhook'

export default {
  /**
   * Keep the custom `status` field in sync with Strapi 5's built-in
   * Draft & Publish system (publishedAt).
   *
   * The page schema has BOTH draftAndPublish (publishedAt) AND a custom
   * status enumeration — they are independent unless we sync them here.
   */
  async beforeUpdate(event: any) {
    const { data } = event.params

    if (Object.prototype.hasOwnProperty.call(data, 'publishedAt')) {
      if (data.publishedAt === null) {
        // Unpublish → mark as draft
        data.status = 'draft'
      } else {
        // Publish → mark as published
        data.status = 'published'
      }
    }
  },

  async afterUpdate(event: any) {
    const documentId = event?.params?.documentId
    if (documentId) {
      await logBuildWebhook(strapi, 'api::page.page', documentId)
    }
  },
}
