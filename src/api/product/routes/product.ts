/**
 * Product routes.
 *
 * Extends core CRUD with a batch-update custom endpoint
 * for bulk editing site, category, and MOQ fields.
 */

export default {
  type: 'content-api',
  routes: [
    // ── Custom: batch update (admin only) ─────────────────────────────
    {
      method: 'POST',
      path: '/products/batch-update',
      handler: 'product.batchUpdate',
      config: { auth: false, policies: [] },
    },
  ],
}
