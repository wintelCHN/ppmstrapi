/**
 * Blog routes.
 *
 * createCoreRouter() can't be combined with custom content-api routes in this
 * project, so core CRUD routes are listed explicitly.
 */

export default {
  type: 'content-api',
  routes: [
    // Core CRUD
    {
      method: 'GET',
      path: '/blogs',
      handler: 'blog.find',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/blogs/:documentId',
      handler: 'blog.findOne',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/blogs',
      handler: 'blog.create',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/blogs/:documentId',
      handler: 'blog.update',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/blogs/:documentId',
      handler: 'blog.delete',
      config: { policies: [] },
    },
    // Custom n8n entrypoint. Auth is verified inside the controller.
    {
      method: 'POST',
      path: '/blogs/save-from-n8n',
      handler: 'blog.saveFromN8n',
      config: { auth: false, policies: [] },
    },
  ],
}
