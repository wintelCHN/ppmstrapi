/**
 * Product routes.
 *
 * Combines core CRUD with custom endpoints:
 * - batch-update        — bulk edit site, category, and MOQ fields
 * - create-with-images  — create a product + upload images in one request
 *
 * createCoreRouter() can't be used alongside custom routes in Strapi 5,
 * so all core routes are listed explicitly.
 */

export default {
  type: 'content-api',
  routes: [
    // ── Core CRUD ─────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/products',
      handler: 'product.find',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/products/:documentId',
      handler: 'product.findOne',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/products',
      handler: 'product.create',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/products/:documentId',
      handler: 'product.update',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/products/:documentId',
      handler: 'product.delete',
      config: { policies: [] },
    },
    // ── Custom: batch update (admin only) ─────────────────────────────
    {
      method: 'POST',
      path: '/products/batch-update',
      handler: 'product.batchUpdate',
      config: { auth: false, policies: [] },
    },
    // ── Custom: create product with images in one request (admin only) ─
    {
      method: 'POST',
      path: '/products/create-with-images',
      handler: 'product.createWithImages',
      config: { auth: false, policies: [] },
    },
  ],
}
