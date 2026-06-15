/**
 * Application bootstrap.
 * Called on every start.
 *
 * - Ensures Public role has read-only permissions for all content types.
 * - First-run init marker is set once.
 */

interface PermissionConfig {
  uid: string
  actions: string[]
}

/** Content types to expose via Public API (find + findOne). */
const PUBLIC_READ_CONTENT_TYPES: PermissionConfig[] = [
  { uid: 'api::site.site', actions: ['find', 'findOne'] },
  { uid: 'api::category.category', actions: ['find', 'findOne'] },
  { uid: 'api::product.product', actions: ['find', 'findOne'] },
  { uid: 'api::page.page', actions: ['find', 'findOne'] },
  { uid: 'api::global.global', actions: ['find', 'findOne'] },
  { uid: 'api::blog.blog', actions: ['find', 'findOne'] },
  { uid: 'api::news.news', actions: ['find', 'findOne'] },
]

export async function bootstrap() {
  await setupPublicPermissions()
  await markFirstRun()
}

async function setupPublicPermissions() {
  try {
    const publicRole = await strapi
      .documents('plugin::users-permissions.role')
      .findFirst({
        filters: { type: 'public' },
      })

    if (!publicRole) {
      strapi.log.warn('[Bootstrap] Public role not found — skipping permission setup.')
      return
    }

    const roleDocumentId = (publicRole as Record<string, unknown>).documentId as string

    for (const config of PUBLIC_READ_CONTENT_TYPES) {
      for (const action of config.actions) {
        const actionName = `${config.uid}.${action}`

        // Check if permission already exists to keep idempotent.
        const existing = await strapi
          .documents('plugin::users-permissions.permission')
          .findFirst({
            filters: {
              action: actionName,
              role: { documentId: roleDocumentId },
            },
          })

        if (!existing) {
          await strapi.documents('plugin::users-permissions.permission').create({
            data: {
              action: actionName,
              role: { documentId: roleDocumentId },
            },
          })
          strapi.log.info(`[Bootstrap] Granted: ${actionName}`)
        }
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    strapi.log.error(`[Bootstrap] Permission setup failed: ${message}`)
  }
}

async function markFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: 'type',
    name: 'setup',
  })
  const initHasRun = await pluginStore.get({ key: 'initHasRun' })
  if (!initHasRun) {
    await pluginStore.set({ key: 'initHasRun', value: true })
    strapi.log.info('[B2B CMS] First run — no seed data imported.')
  }
}
