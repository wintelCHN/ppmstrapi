/**
 * Tag routes.
 *
 * Combines core CRUD with custom endpoints.
 * Public read endpoints use auth: false for Astro build-time access.
 */

export default {
  type: 'content-api',
  routes: [
    // ── Core CRUD ────────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/tags',
      handler: 'tag.find',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/tags/:documentId',
      handler: 'tag.findOne',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/tags',
      handler: 'tag.create',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/tags/:documentId',
      handler: 'tag.update',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/tags/:documentId',
      handler: 'tag.delete',
      config: { policies: [] },
    },

    // ── Custom: tag cloud (public) ──────────────────────────────────────
    {
      method: 'GET',
      path: '/tags/cloud',
      handler: 'tag.cloud',
      config: { auth: false, policies: [] },
    },

    // ── Custom: single tag by slug (public, for SEO aggregation pages) ──
    {
      method: 'GET',
      path: '/tags/by-slug/:slug',
      handler: 'tag.findBySlug',
      config: { auth: false, policies: [] },
    },

    // ── Custom: products by tag slug (public, for Layer 2 aggregation) ──
    {
      method: 'GET',
      path: '/tags/:slug/products',
      handler: 'tag.products',
      config: { auth: false, policies: [] },
    },

    // ── Custom: merge tags (admin only) ─────────────────────────────────
    {
      method: 'POST',
      path: '/tags/merge',
      handler: 'tag.merge',
      config: { policies: [] },
    },

    // ── Custom: statistics (public) ─────────────────────────────────────
    {
      method: 'GET',
      path: '/tags/statistics',
      handler: 'tag.statistics',
      config: { auth: false, policies: [] },
    },

    // ── Custom: duplicate suggestions (admin only) ──────────────────────
    {
      method: 'GET',
      path: '/tags/suggest-duplicates',
      handler: 'tag.suggestDuplicates',
      config: { policies: [] },
    },
  ],
}
