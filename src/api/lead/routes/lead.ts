/**
 * Lead routes.
 *
 * Uses raw route format to combine core CRUD with custom endpoints.
 * createCoreRouter() can't be used alongside custom routes in Strapi 5.
 */

export default {
  type: 'content-api',
  routes: [
    // ── Core CRUD (admin) ──
    {
      method: 'GET',
      path: '/leads',
      handler: 'lead.find',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/leads/:documentId',
      handler: 'lead.findOne',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/leads',
      handler: 'lead.create',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/leads/:documentId',
      handler: 'lead.update',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/leads/:documentId',
      handler: 'lead.delete',
      config: { policies: [] },
    },
    // ── Custom: public lead submission ──
    {
      method: 'POST',
      path: '/public/lead',
      handler: 'lead.createPublic',
      config: {
        auth: false,
        policies: [],
      },
    },
    // ── Custom: CSV export (admin auth via core policy) ──
    {
      method: 'GET',
      path: '/leads/export',
      handler: 'lead.export',
      config: { policies: [] },
    },
  ],
}
