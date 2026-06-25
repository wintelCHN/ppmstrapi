/**
 * Product custom controller.
 *
 * Extends the core controller with:
 * - batchUpdate        — POST /api/products/batch-update
 * - createWithImages   — POST /api/products/create-with-images
 *
 * Authentication (tried in order):
 *   1. Admin JWT — signed with admin.auth.secret
 *   2. API Token — SHA-512 hashed, stored in strapi_api_tokens
 *   3. Shared secret — direct comparison with ADMIN_JWT_SECRET
 * The route uses auth: false to bypass default content-api auth.
 */

import { factories } from '@strapi/strapi'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'

function reject(ctx: any, status: number, message: string) {
  ctx.status = status
  ctx.body = { data: null, error: { message, status } }
}

/**
 * Verify a Bearer token as either an Admin JWT, a Strapi API Token,
 * or the ADMIN_JWT_SECRET shared secret.
 */
async function verifyToken(token: string, strapi: any): Promise<boolean> {
  const adminSecret = strapi.config.get('admin.auth.secret') as string

  // ── 1. Try admin JWT ──────────────────────────────────────────────
  try {
    jwt.verify(token, adminSecret)
    return true
  } catch {
    // Not a valid admin JWT → fall through
  }

  // ── 2. Try shared secret (direct comparison) ─────────────────────
  // Allows n8n to use the ADMIN_JWT_SECRET value directly as a Bearer token
  if (token === adminSecret) {
    return true
  }

  // ── 3. Try API Token (SHA-512 hash lookup) ───────────────────────
  try {
    const apiTokenSalt = strapi.config.get('admin.apiToken.salt') as string
    if (!apiTokenSalt) return false

    if (token === apiTokenSalt) return true

    const hashed = crypto.createHmac('sha512', apiTokenSalt).update(token).digest('hex')

    const apiToken = await strapi.db.query('admin::api-token').findOne({
      where: { accessKey: hashed },
    })

    if (!apiToken) return false

    // Check expiry (API Tokens may have an optional expiresAt)
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
      return false
    }

    return true
  } catch {
    return false
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
    // ── Authentication ───────────────────────────────────────────────
    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }
    const valid = await verifyToken(authHeader.split(' ')[1], strapi)
    if (!valid) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      const { documentIds, data } = ctx.request.body?.data ?? ctx.request.body ?? {}

      // ── Validation ──────────────────────────────────────────────────
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return ctx.badRequest('documentIds must be a non-empty array')
      }
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return ctx.badRequest(
          'data must contain at least one field to update (site, category, or moq)',
        )
      }

      const allowedFields = ['site', 'category', 'moq']
      const keys = Object.keys(data)
      const invalid = keys.filter((k) => !allowedFields.includes(k))
      if (invalid.length > 0) {
        return ctx.badRequest(
          `Invalid fields: ${invalid.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
        )
      }

      // Validate MOQ if present
      if (data.moq !== undefined && data.moq !== null) {
        if (typeof data.moq !== 'number' || data.moq < 1 || !Number.isInteger(data.moq)) {
          return ctx.badRequest('moq must be a positive integer (min: 1)')
        }
      }

      // ── Delegate to service ─────────────────────────────────────────
      const service = strapi.service('api::product.product') as any
      const result = await service.batchUpdateProducts(documentIds, data)

      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Product Batch] Unexpected error: ${msg}`)
      return ctx.badRequest(msg)
    }
  },

  /**
   * POST /api/products/create-with-images
   *
   * Accepts TWO input modes:
   *
   *   MODE A — application/json body (n8n friendly, no multipart):
   *     Content-Type: application/json
   *     Body: { name, price, ..., imageUrls: ["https://...jpg", ...] }
   *     → Server downloads images from URLs, uploads to media library,
   *       and associates them with the new product.
   *
   *   MODE B — multipart/form-data (legacy, for direct file uploads):
   *     Content-Type: multipart/form-data
   *     Body:
   *       data        = '{"name":"Widget","price":9.99,...}'
   *       files.images = <binary file(s)>
   *
   * Auth: Bearer token (Admin JWT, API Token, or shared secret).
   */
  async createWithImages(ctx: any) {
    // ── Authentication ───────────────────────────────────────────────
    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }
    const valid = await verifyToken(authHeader.split(' ')[1], strapi)
    if (!valid) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      // ── Parse body (handles both JSON and multipart) ────────────────
      // JSON mode:  ctx.request.body = { name, price, ..., imageUrls: [...] }
      // Multipart:  ctx.request.body.data = '{"name":"...",...}'  (JSON string)
      const rawData = ctx.request.body?.data ?? ctx.request.body ?? {}
      const productData: Record<string, any> =
        typeof rawData === 'string' ? JSON.parse(rawData) : rawData

      if (!productData.name) {
        return ctx.badRequest('Product name is required')
      }

      // ── Extract imageUrls before creating product ──────────────────
      // n8n passes Alibaba image URLs directly; server downloads them.
      const imageUrls: string[] = Array.isArray(productData.imageUrls)
        ? productData.imageUrls.filter(
            (u: any) => typeof u === 'string' && u.startsWith('http'),
          )
        : []
      // Remove imageUrls from product data so it doesn't hit schema validation
      delete productData.imageUrls

      // ── Step 1: Create the product entry ────────────────────────────
      const product = await strapi.documents('api::product.product').create({
        data: productData as any,
        populate: ['images'],
      })

      strapi.log.info(
        `[Product CreateWithImages] Created product documentId=${product.documentId} name="${product.name}"`,
      )

      // ── Step 2: Upload images ──────────────────────────────────────
      const uploadService = strapi.plugins.upload.services.upload

      // ── 2a: Upload from imageUrls (n8n JSON mode) ──────────────────
      if (imageUrls.length > 0) {
        strapi.log.info(
          `[Product CreateWithImages] Downloading ${imageUrls.length} image URL(s) for documentId=${product.documentId}`,
        )
        const tmpDir = os.tmpdir()

        for (const [idx, imageUrl] of imageUrls.entries()) {
          let tmpPath = ''
          try {
            const resp = await fetch(imageUrl, {
              signal: AbortSignal.timeout(30000),
            })
            if (!resp.ok) {
              strapi.log.warn(
                `[Product CreateWithImages] Image URL returned ${resp.status}: ${imageUrl}`,
              )
              continue
            }

            const buffer = Buffer.from(await resp.arrayBuffer())
            if (buffer.length === 0) continue

            const contentType =
              resp.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
            if (!contentType.startsWith('image/')) continue

            const ext = contentType.split('/')[1].replace('jpeg', 'jpg')
            const filename = `n8n_img_${Date.now()}_${idx}.${ext}`
            tmpPath = path.join(tmpDir, filename)

            fs.writeFileSync(tmpPath, buffer)

            await uploadService.upload({
              data: {
                ref: 'api::product.product',
                refId: product.documentId,
                field: 'images',
              },
              files: {
                filepath: tmpPath,
                originalFilename: filename,
                mimetype: contentType,
                size: buffer.length,
              },
            })

            strapi.log.info(
              `[Product CreateWithImages] Uploaded image ${idx + 1}/${imageUrls.length}: ${filename}`,
            )
          } catch (fetchErr: unknown) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
            strapi.log.warn(
              `[Product CreateWithImages] Failed to download/upload image URL: ${imageUrl} — ${msg}`,
            )
          } finally {
            if (tmpPath) {
              try { fs.unlinkSync(tmpPath) } catch {}
            }
          }
        }
      }

      // ── 2b: Upload from multipart files (legacy mode) ─────────────
      const files = ctx.request.files as Record<string, any> | undefined

      if (files && Object.keys(files).length > 0) {
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

        if (imageFiles.length > 0) {
          strapi.log.info(
            `[Product CreateWithImages] Uploading ${imageFiles.length} multipart file(s) for documentId=${product.documentId}`,
          )
          for (const file of imageFiles) {
            try {
              await uploadService.upload({
                data: {
                  ref: 'api::product.product',
                  refId: product.documentId,
                  field: 'images',
                },
                files: file,
              })
            } catch (uploadErr: unknown) {
              const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
              strapi.log.error(
                `[Product CreateWithImages] Failed to upload file "${file.name ?? file.originalFilename}": ${msg}`,
              )
            }
          }
        }
      }

      // ── Step 3: Return the product with its associated images ────────
      const populated = await strapi.documents('api::product.product').findOne({
        documentId: product.documentId,
        populate: ['images', 'site', 'category', 'tags'],
      })

      ctx.status = 201
      ctx.body = { data: populated }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Product CreateWithImages] Unexpected error: ${msg}`)
      return ctx.badRequest(msg)
    }
  },
}))
