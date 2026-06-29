import { factories } from '@strapi/strapi'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

function reject(ctx: any, status: number, message: string) {
  ctx.status = status
  ctx.body = { data: null, error: { message, status } }
}

async function verifyToken(token: string, strapi: any): Promise<boolean> {
  const adminSecret = strapi.config.get('admin.auth.secret') as string

  try {
    jwt.verify(token, adminSecret)
    return true
  } catch {
    // Not an admin JWT; continue with project-specific fallbacks.
  }

  if (token === adminSecret) return true

  try {
    const apiTokenSalt = strapi.config.get('admin.apiToken.salt') as string
    if (!apiTokenSalt) return false
    if (token === apiTokenSalt) return true

    const hashed = crypto.createHmac('sha512', apiTokenSalt).update(token).digest('hex')
    const apiToken = await strapi.db.query('admin::api-token').findOne({
      where: { accessKey: hashed },
    })

    if (!apiToken) return false
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) return false

    return true
  } catch {
    return false
  }
}

function getPayload(ctx: any): Record<string, any> {
  const raw = ctx.request.body?.data ?? ctx.request.body ?? {}
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

function cleanBlogData(input: Record<string, any>) {
  const data: Record<string, any> = {
    title: input.title,
    status: input.status || 'draft',
    metadata: input.metadata,
    article_meta: input.article_meta,
    content: input.content,
  }

  if (input.site) data.site = input.site

  for (const key of Object.keys(data)) {
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      delete data[key]
    }
  }

  return data
}

export default factories.createCoreController('api::blog.blog', ({ strapi }) => ({
  async saveFromN8n(ctx: any) {
    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    const valid = await verifyToken(authHeader.split(' ')[1], strapi)
    if (!valid) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      const payload = getPayload(ctx)
      const data = cleanBlogData(payload)
      const documentId = payload.documentId || payload._existingDocumentId

      if (!data.title) return ctx.badRequest('Blog title is required')

      const blog = documentId
        ? await strapi.documents('api::blog.blog').update({
            documentId,
            data: data as any,
            populate: ['metadata', 'article_meta', 'site'],
          })
        : await strapi.documents('api::blog.blog').create({
            data: data as any,
            populate: ['metadata', 'article_meta', 'site'],
          })

      ctx.status = documentId ? 200 : 201
      ctx.body = { data: blog }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Blog SaveFromN8n] Unexpected error: ${msg}`)
      return ctx.badRequest(msg)
    }
  },
}))
