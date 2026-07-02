/**
 * Product custom controller.
 *
 * Extends the core controller with:
 * - batchUpdate        — POST /api/products/batch-update
 * - createWithImages   — POST /api/products/create-with-images
 *
 * Authentication (tried in order):
 *   1. Admin JWT — signed with admin.auth.secret
 *   2. N8N_API_TOKEN — dedicated integration token from env
 *   3. Strapi Content-API Token — full-access/custom with required actions
 *   4. Strapi Admin API Token — active admin-owned token
 * The route uses auth: false to bypass default content-api auth.
 */

import { factories } from '@strapi/strapi'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { verifyToken } from '../../shared/auth'
import { rateLimit } from '../../shared/rate-limit'
import { isSafeImageUrl } from '../../shared/url'

const MAX_UPLOAD_FILE_SIZE = 50 * 1024 * 1024 // 50 MB per decoded image
const BATCH_UPDATE_RATE_LIMIT = { windowMs: 60_000, max: 30 }
const CREATE_WITH_IMAGES_RATE_LIMIT = { windowMs: 60_000, max: 30 }

const PRODUCT_ACTIONS = ['api::product.product.create', 'api::product.product.update']

function reject(ctx: any, status: number, message: string) {
  ctx.status = status
  ctx.body = { data: null, error: { message, status } }
}

function internalServerError(ctx: any, strapi: any, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  strapi.log.error(`[Product Controller] ${msg}`)
  return reject(ctx, 500, 'Internal server error')
}

function deriveImageAltText(rawValue: unknown): string {
  if (typeof rawValue !== 'string') return ''

  const cleaned = rawValue
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b(manufacturer|factory|supplier|exporter|wholesale|bulk|b2b|distributor|custom|oem|odm|private label|china|chinese|in china)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned.slice(0, 120).trim()
}

function safeTmpFilename(mimetype: string, prefix: string, index: number): string {
  const ext = (mimetype.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg')
  return `${prefix}_${Date.now()}_${index}.${ext}`.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function normalizeUploadResult(uploadResult: unknown): Array<Record<string, any>> {
  if (Array.isArray(uploadResult)) {
    return uploadResult.filter(
      (file): file is Record<string, any> => !!file && typeof file === 'object',
    )
  }
  if (uploadResult && typeof uploadResult === 'object') {
    return [uploadResult as Record<string, any>]
  }
  return []
}

async function backfillAlternativeText(
  strapi: any,
  uploadResult: unknown,
  alternativeText: string,
) {
  if (!alternativeText) return

  for (const file of normalizeUploadResult(uploadResult)) {
    if (!file.id || file.alternativeText) continue

    await strapi.db.query('plugin::upload.file').update({
      where: { id: file.id },
      data: { alternativeText },
    })
  }
}

function parseProductPayload(ctx: any): Record<string, any> {
  const rawData = ctx.request.body?.data ?? ctx.request.body ?? {}
  return typeof rawData === 'string' ? JSON.parse(rawData) : { ...rawData }
}

function extractImageInputs(input: Record<string, any>) {
  const imageBase64: Array<{ filename: string; data: string; mimetype?: string }> = Array.isArray(
    input.imageBase64,
  )
    ? input.imageBase64.filter(
        (e: any) =>
          typeof e?.filename === 'string' &&
          typeof e?.data === 'string' &&
          e.data.length > 0,
      )
    : []

  const imageUrls: string[] = Array.isArray(input.imageUrls)
    ? input.imageUrls.filter((u: any) => typeof u === 'string' && isSafeImageUrl(u))
    : []

  const imageAltText = deriveImageAltText(
    input.imageAltText ?? input.altText ?? input.name,
  )

  const { imageBase64: _b64, imageUrls: _urls, imageAltText: _alt, altText: _alt2, ...rest } =
    input

  return { imageBase64, imageUrls, imageAltText, productData: rest }
}

function normalizeSeoFields(input: Record<string, any>): Record<string, any> {
  if (input.metadata && typeof input.metadata === 'object') {
    const { seo_title, seo_description, seo_keywords, ...rest } = input
    return rest
  }

  const metadata = {
    metaTitle: input.seo_title ?? input.name ?? '',
    metaDescription: input.seo_description ?? '',
    metaKeywords: input.seo_keywords ?? '',
  }
  const { seo_title, seo_description, seo_keywords, ...rest } = input
  return { ...rest, metadata }
}

function normalizeProductSchema(input: Record<string, any>): Record<string, any> {
  const schema =
    input.product_schema && typeof input.product_schema === 'object'
      ? { ...input.product_schema }
      : { brand: 'PRONEO' }

  if (!schema.brand) schema.brand = 'PRONEO'

  const { product_schema, ...rest } = input
  return { ...rest, product_schema: schema }
}

async function findDuplicateBySourceUrl(strapi: any, sourceUrl: string) {
  const existing = await strapi.documents('api::product.product').findMany({
    filters: { source_url: sourceUrl },
    limit: 1,
    populate: ['images', 'metadata', 'product_schema', 'site', 'category', 'tags'],
  })
  return existing?.[0] ?? null
}

async function uploadFromBase64(
  strapi: any,
  product: any,
  images: Array<{ filename: string; data: string; mimetype?: string }>,
  altText: string,
): Promise<Array<{ filename?: string; ok: boolean; error?: string }>> {
  const uploadService = strapi.plugins.upload.services.upload
  const tmpDir = os.tmpdir()
  const results: Array<{ filename?: string; ok: boolean; error?: string }> = []

  for (const [idx, img] of images.entries()) {
    const filename = safeTmpFilename(
      img.mimetype?.startsWith('image/') ? img.mimetype : 'image/jpeg',
      'n8n_base64',
      idx,
    )
    const tmpPath = path.join(tmpDir, filename)

    try {
      const buf = Buffer.from(img.data, 'base64')
      if (buf.length === 0) {
        results.push({ filename: img.filename, ok: false, error: 'Empty base64 data' })
        continue
      }
      if (buf.length > MAX_UPLOAD_FILE_SIZE) {
        results.push({ filename: img.filename, ok: false, error: 'File too large' })
        continue
      }

      const mimetype =
        img.mimetype?.startsWith('image/') ? img.mimetype : 'image/jpeg'

      await fs.promises.writeFile(tmpPath, buf)

      const uploadResult = await uploadService.upload({
        data: {
          ref: 'api::product.product',
          refId: product.id,
          field: 'images',
          ...(altText ? { fileInfo: { alternativeText: altText } } : {}),
        },
        files: {
          filepath: tmpPath,
          originalFilename: img.filename || filename,
          mimetype,
          size: buf.length,
        },
      })

      await backfillAlternativeText(strapi, uploadResult, altText)
      results.push({ filename: img.filename, ok: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ filename: img.filename, ok: false, error: msg })
      strapi.log.warn(`[Product CreateWithImages] Base64 upload failed: ${msg}`)
    } finally {
      try {
        await fs.promises.unlink(tmpPath)
      } catch {
        // tmp file may not exist; ignore cleanup failures
      }
    }
  }

  return results
}

async function uploadFromUrls(
  strapi: any,
  product: any,
  urls: string[],
  altText: string,
): Promise<Array<{ url?: string; ok: boolean; error?: string }>> {
  const uploadService = strapi.plugins.upload.services.upload
  const tmpDir = os.tmpdir()
  const results: Array<{ url?: string; ok: boolean; error?: string }> = []

  for (const [idx, imageUrl] of urls.entries()) {
    const filename = safeTmpFilename('image/jpeg', 'n8n_url', idx)
    const tmpPath = path.join(tmpDir, filename)

    try {
      const resp = await fetch(imageUrl, {
        signal: AbortSignal.timeout(30000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept:
            'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.alibaba.com/',
        },
      })
      if (!resp.ok) {
        results.push({ url: imageUrl, ok: false, error: `HTTP ${resp.status}` })
        strapi.log.warn(`[Product CreateWithImages] Image URL returned ${resp.status}: ${imageUrl}`)
        continue
      }

      const buffer = Buffer.from(await resp.arrayBuffer())
      if (buffer.length === 0) {
        results.push({ url: imageUrl, ok: false, error: 'Empty body' })
        continue
      }
      if (buffer.length > MAX_UPLOAD_FILE_SIZE) {
        results.push({ url: imageUrl, ok: false, error: 'File too large' })
        continue
      }

      const contentType =
        resp.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
      if (!contentType.startsWith('image/')) {
        results.push({ url: imageUrl, ok: false, error: `Not an image: ${contentType}` })
        continue
      }

      await fs.promises.writeFile(tmpPath, buffer)

      const uploadResult = await uploadService.upload({
        data: {
          ref: 'api::product.product',
          refId: product.id,
          field: 'images',
          ...(altText ? { fileInfo: { alternativeText: altText } } : {}),
        },
        files: {
          filepath: tmpPath,
          originalFilename: filename,
          mimetype: contentType,
          size: buffer.length,
        },
      })

      await backfillAlternativeText(strapi, uploadResult, altText)
      results.push({ url: imageUrl, ok: true })
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      results.push({ url: imageUrl, ok: false, error: msg })
      strapi.log.warn(`[Product CreateWithImages] URL download failed: ${imageUrl} — ${msg}`)
    } finally {
      try {
        await fs.promises.unlink(tmpPath)
      } catch {
        // ignore cleanup failures
      }
    }
  }

  return results
}

function collectMultipartFiles(files: Record<string, any> | undefined): any[] {
  if (!files) return []
  const imageFiles: any[] = []

  for (const [key, value] of Object.entries(files)) {
    if (key === 'files.images' || key === 'files' || key.startsWith('files')) {
      if (Array.isArray(value)) {
        imageFiles.push(...value)
      } else {
        imageFiles.push(value)
      }
    }
  }

  return imageFiles
}

async function uploadFromMultipart(
  strapi: any,
  product: any,
  files: any[],
  altText: string,
) {
  const uploadService = strapi.plugins.upload.services.upload

  for (const file of files) {
    try {
      const uploadResult = await uploadService.upload({
        data: {
          ref: 'api::product.product',
          refId: product.id,
          field: 'images',
          ...(altText ? { fileInfo: { alternativeText: altText } } : {}),
        },
        files: file,
      })

      await backfillAlternativeText(strapi, uploadResult, altText)
    } catch (uploadErr: unknown) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
      strapi.log.error(
        `[Product CreateWithImages] Multipart upload failed: ${file.name ?? file.originalFilename} — ${msg}`,
      )
    }
  }
}

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  /**
   * POST /api/products/batch-update
   *
   * Body: { data: { documentIds: string[], data: { site?, category?, moq? } } }
   *
   * Updates site, category, and/or MOQ for a batch of products.
   */
  async batchUpdate(ctx: any) {
    if (!(await rateLimit(ctx, BATCH_UPDATE_RATE_LIMIT))) return

    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }
    const valid = await verifyToken(authHeader.split(' ')[1], strapi, PRODUCT_ACTIONS)
    if (!valid) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      const { documentIds, data } = ctx.request.body?.data ?? ctx.request.body ?? {}

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return ctx.badRequest('documentIds must be a non-empty array')
      }
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return ctx.badRequest(
          'data must contain at least one field to update (site, category, or moq)',
        )
      }

      const allowedFields = ['site', 'category', 'moq']
      const invalid = Object.keys(data).filter((k) => !allowedFields.includes(k))
      if (invalid.length > 0) {
        return ctx.badRequest(
          `Invalid fields: ${invalid.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
        )
      }

      if (data.moq !== undefined && data.moq !== null) {
        if (typeof data.moq !== 'number' || data.moq < 1 || !Number.isInteger(data.moq)) {
          return ctx.badRequest('moq must be a positive integer (min: 1)')
        }
      }

      const service = strapi.service('api::product.product') as any
      return await service.batchUpdateProducts(documentIds, data)
    } catch (err: unknown) {
      return internalServerError(ctx, strapi, err)
    }
  },

  /**
   * POST /api/products/create-with-images
   *
   * Accepts THREE input modes:
   *
   *   MODE A — imageBase64 (n8n with BrightData proxy, recommended)
   *   MODE B — imageUrls (server-side download from public URLs)
   *   MODE C — multipart/form-data (legacy, direct file uploads)
   *
   * Auth: Bearer token (Admin JWT, N8N token, Content-API token, Admin API token).
   */
  async createWithImages(ctx: any) {
    if (!(await rateLimit(ctx, CREATE_WITH_IMAGES_RATE_LIMIT))) return

    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }
    const valid = await verifyToken(authHeader.split(' ')[1], strapi, PRODUCT_ACTIONS)
    if (!valid) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      const rawPayload = parseProductPayload(ctx)
      if (!rawPayload.name) {
        return ctx.badRequest('Product name is required')
      }

      const { imageBase64, imageUrls, imageAltText, productData } =
        extractImageInputs(rawPayload)

      const normalized = normalizeProductSchema(normalizeSeoFields(productData))

      if (normalized.source_url) {
        const existing = await findDuplicateBySourceUrl(strapi, normalized.source_url)
        if (existing) {
          strapi.log.info(
            `[Product CreateWithImages] Duplicate source_url skipped: ${normalized.source_url} → existing documentId=${existing.documentId}`,
          )
          ctx.status = 200
          ctx.body = {
            data: existing,
            _skipped: true,
            _reason: `Duplicate source_url (existing documentId: ${existing.documentId})`,
          }
          return
        }
      }

      const product = await strapi.documents('api::product.product').create({
        data: normalized as any,
        populate: ['images', 'metadata', 'product_schema'],
      })

      strapi.log.info(
        `[Product CreateWithImages] Created product documentId=${product.documentId} name="${product.name}"`,
      )

      const imageResults: Array<Record<string, any>> = []

      if (imageBase64.length > 0) {
        strapi.log.info(
          `[Product CreateWithImages] Decoding ${imageBase64.length} base64 image(s) for documentId=${product.documentId}`,
        )
        imageResults.push(...(await uploadFromBase64(strapi, product, imageBase64, imageAltText)))
      }

      if (imageUrls.length > 0) {
        strapi.log.info(
          `[Product CreateWithImages] Downloading ${imageUrls.length} image URL(s) for documentId=${product.documentId}`,
        )
        imageResults.push(...(await uploadFromUrls(strapi, product, imageUrls, imageAltText)))
      }

      const multipartFiles = collectMultipartFiles(ctx.request.files)
      if (multipartFiles.length > 0) {
        strapi.log.info(
          `[Product CreateWithImages] Uploading ${multipartFiles.length} multipart file(s) for documentId=${product.documentId}`,
        )
        await uploadFromMultipart(strapi, product, multipartFiles, imageAltText)
      }

      const populated = await strapi.documents('api::product.product').findOne({
        documentId: product.documentId,
        populate: ['images', 'metadata', 'product_schema', 'site', 'category', 'tags'],
      })

      ctx.status = 201
      ctx.body = {
        data: populated,
        _imageResults: imageResults.length > 0 ? imageResults : undefined,
      }
    } catch (err: unknown) {
      return internalServerError(ctx, strapi, err)
    }
  },
}))
