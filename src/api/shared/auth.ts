import jwt from 'jsonwebtoken'
import crypto from 'crypto'

/**
 * Verify a Bearer token for custom admin-only endpoints.
 *
 * Accepted credentials (tried in order):
 *   1. Admin JWT — signed with admin.auth.secret
 *   2. N8N_API_TOKEN — dedicated integration token from env
 *   3. Strapi Content-API Token — `full-access` passes; `custom` must have all
 *      `requiredActions`; `read-only` is rejected.
 *   4. Strapi Admin API Token — must be active and owned by an active admin user.
 *
 * The route must use `config: { auth: false }` to bypass default content-api
 * auth, then call this helper inline.
 */
export async function verifyToken(
  token: string,
  strapi: any,
  requiredActions?: string[],
): Promise<boolean> {
  const adminSecret = strapi.config.get('admin.auth.secret') as string

  // 1. Admin JWT
  try {
    jwt.verify(token, adminSecret, { algorithms: ['HS256'] })
    return true
  } catch (err) {
    strapi.log.debug('[verifyToken] Not a valid Admin JWT')
  }

  // 2. Dedicated n8n integration token
  const n8nToken = process.env.N8N_API_TOKEN
  if (n8nToken && safeEquals(token, n8nToken)) {
    return true
  }

  // 3. Strapi Content-API token
  try {
    const contentApiTokenService = strapi.service('admin::api-token-content-api')
    if (contentApiTokenService) {
      const hashed = contentApiTokenService.hash(token)
      const apiToken = await contentApiTokenService.getByAccessKey(hashed)

      if (apiToken && !isExpired(apiToken)) {
        if (apiToken.type === 'full-access') {
          return true
        }
        if (apiToken.type === 'read-only') {
          strapi.log.debug('[verifyToken] Rejected read-only Content-API token')
          return false
        }
        if (apiToken.type === 'custom') {
          return hasRequiredActions(apiToken.permissions, requiredActions, strapi)
        }
      }
    }
  } catch (err) {
    strapi.log.debug('[verifyToken] Content-API token lookup failed', err)
  }

  // 4. Strapi Admin API token
  try {
    const adminTokenService = strapi.service('admin::api-token-admin')
    if (adminTokenService) {
      const result = await adminTokenService.authenticateAdminToken(token)
      if (result?.authenticated) {
        return true
      }
    }
  } catch (err) {
    strapi.log.debug('[verifyToken] Admin API token lookup failed', err)
  }

  return false
}

function isExpired(apiToken: any): boolean {
  if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
    return true
  }
  return false
}

function hasRequiredActions(
  permissions: any[],
  requiredActions: string[] | undefined,
  strapi: any,
): boolean {
  const perms = Array.isArray(permissions) ? permissions : []
  const hasAction = (action: string) =>
    perms.some((p: any) => p?.action === action || p === action)

  if (!requiredActions || requiredActions.length === 0) {
    strapi.log.debug('[verifyToken] Custom API token used without requiredActions')
    return false
  }

  const missing = requiredActions.filter((action) => !hasAction(action))
  if (missing.length > 0) {
    strapi.log.debug(`[verifyToken] Custom API token missing actions: ${missing.join(', ')}`)
    return false
  }

  return true
}

function safeEquals(a: string, b: string): boolean {
  // Compare fixed-length SHA-256 hashes to avoid leaking the length of the
  // configured N8N_API_TOKEN via timing side-channels.
  const hashA = crypto.createHash('sha256').update(a).digest('hex')
  const hashB = crypto.createHash('sha256').update(b).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hashA), Buffer.from(hashB))
  } catch {
    return false
  }
}
