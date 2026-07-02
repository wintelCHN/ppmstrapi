import { factories } from '@strapi/strapi'
import { verifyToken } from '../../shared/auth'

function reject(ctx: any, status: number, message: string) {
  ctx.status = status
  ctx.body = { data: null, error: { message, status } }
}

function internalServerError(ctx: any, strapi: any, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  strapi.log.error(`[Blog SaveFromN8n] Unexpected error: ${msg}`)
  return reject(ctx, 500, 'Internal server error')
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

function isValidDocumentId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) && value.length <= 128
}

const BLOG_ACTIONS = ['api::blog.blog.create', 'api::blog.blog.update']

export default factories.createCoreController('api::blog.blog', ({ strapi }) => ({
  async saveFromN8n(ctx: any) {
    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    const valid = await verifyToken(authHeader.split(' ')[1], strapi, BLOG_ACTIONS)
    if (!valid) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      const payload = getPayload(ctx)
      const data = cleanBlogData(payload)
      const rawDocumentId = payload.documentId || payload._existingDocumentId
      const documentId = isValidDocumentId(rawDocumentId) ? rawDocumentId : undefined

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
      return internalServerError(ctx, strapi, err)
    }
  },
}))
