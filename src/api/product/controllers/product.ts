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
   * Accepts THREE input modes:
   *
   *   MODE A — imageBase64 (n8n with BrightData proxy, recommended):
   *     Content-Type: application/json
   *     Body: { name, price, ..., imageBase64: [
   *       { filename: "img_0.jpg", data: "<base64>", mimetype: "image/jpeg" }
   *     ]}
   *     → n8n downloads images via BrightData, base64-encodes, Strapi
   *       decodes and uploads to R2. No Railway → Alibaba direct requests.
   *
   *   MODE B — imageUrls (server-side download from public URLs):
   *     Content-Type: application/json
   *     Body: { name, price, ..., imageUrls: ["https://...jpg", ...] }
   *     → Server downloads images from URLs (watch for CDN blocking risk).
   *
   *   MODE C — multipart/form-data (legacy, for direct file uploads):
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

      // ── Extract image inputs before creating product ─────────────────
      // imageBase64: n8n downloads via BrightData proxy, base64-encodes
      //   [{ filename: "img_0.jpg", data: "<base64>", mimetype: "image/jpeg" }]
      const imageBase64: Array<{ filename: string; data: string; mimetype?: string }> =
        Array.isArray(productData.imageBase64)
          ? productData.imageBase64.filter(
              (e: any) =>
                typeof e?.filename === 'string' &&
                typeof e?.data === 'string' &&
                e.data.length > 0,
            )
          : []
      delete productData.imageBase64

      // imageUrls: server-side download from public URLs (legacy, CDN blocking risk)
      const imageUrls: string[] = Array.isArray(productData.imageUrls)
        ? productData.imageUrls.filter(
            (u: any) => typeof u === 'string' && u.startsWith('http'),
          )
        : []
      delete productData.imageUrls

      // ── Normalize SEO: accept both flat fields (old n8n) and nested metadata (new n8n) ──
      if (!productData.metadata) {
        productData.metadata = {
          metaTitle: productData.seo_title ?? productData.name ?? '',
          metaDescription: productData.seo_description ?? '',
          metaKeywords: productData.seo_keywords ?? '',
        }
      }
      delete productData.seo_title
      delete productData.seo_description
      delete productData.seo_keywords

      // ── Normalize product_schema: default brand if not provided ──
      if (!productData.product_schema || typeof productData.product_schema !== 'object') {
        productData.product_schema = { brand: 'PRONEO' }
      } else if (!productData.product_schema.brand) {
        productData.product_schema.brand = 'PRONEO'
      }

      // ── Dedup: check source_url before creating ───────────────────
      // Prevents duplicate products when sheet update fails & retries
      if (productData.source_url) {
        const existing = await strapi.documents('api::product.product').findMany({
          filters: { source_url: productData.source_url },
          limit: 1,
          populate: ['images', 'metadata', 'product_schema', 'site', 'category', 'tags'],
        })
        if (existing && existing.length > 0) {
          strapi.log.info(
            `[Product CreateWithImages] Duplicate source_url skipped: ${productData.source_url} → existing documentId=${existing[0].documentId}`,
          )
          ctx.status = 200
          ctx.body = {
            data: existing[0],
            _skipped: true,
            _reason: `Duplicate source_url (existing documentId: ${existing[0].documentId})`,
          }
          return
        }
      }

      // ── Step 1: Create the product entry ────────────────────────────
      const product = await strapi.documents('api::product.product').create({
        data: productData as any,
        populate: ['images', 'metadata', 'product_schema'],
      })

      strapi.log.info(
        `[Product CreateWithImages] Created product documentId=${product.documentId} name="${product.name}"`,
      )

      // ── Step 2: Upload images ──────────────────────────────────────
      const uploadService = strapi.plugins.upload.services.upload

      // ── 2a: Upload from imageBase64 (n8n BrightData proxy, recommended) ──
      const imageResults: Array<{ filename?: string; url?: string; ok: boolean; error?: string }> = []

      if (imageBase64.length > 0) {
        strapi.log.info(
          `[Product CreateWithImages] Decoding ${imageBase64.length} base64 image(s) for documentId=${product.documentId}`,
        )
        const tmpDir = os.tmpdir()

        for (const [idx, img] of imageBase64.entries()) {
          let tmpPath = ''
          try {
            const buf = Buffer.from(img.data, 'base64')
            if (buf.length === 0) {
              imageResults.push({ filename: img.filename, ok: false, error: 'Empty base64 data' })
              continue
            }

            const mimetype =
              img.mimetype?.startsWith('image/') ? img.mimetype : 'image/jpeg'
            const ext = mimetype.split('/')[1].replace('jpeg', 'jpg')
            const filename = img.filename || `n8n_img_${Date.now()}_${idx}.${ext}`
            tmpPath = path.join(tmpDir, filename.replace(/[<>:"/\\|?*]/g, '_'))

            fs.writeFileSync(tmpPath, buf)

            await uploadService.upload({
              data: {
                ref: 'api::product.product',
                refId: product.id,
                field: 'images',
              },
              files: {
                filepath: tmpPath,
                originalFilename: filename,
                mimetype,
                size: buf.length,
              },
            })

            imageResults.push({ filename: img.filename, ok: true })
            strapi.log.info(
              `[Product CreateWithImages] Uploaded base64 image ${idx + 1}/${imageBase64.length}: ${filename}`,
            )
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            imageResults.push({ filename: img.filename, ok: false, error: msg })
            strapi.log.warn(
              `[Product CreateWithImages] Failed to decode/upload base64 image "${img.filename}": ${msg}`,
            )
          } finally {
            if (tmpPath) {
              try { fs.unlinkSync(tmpPath) } catch {}
            }
          }
        }
      }

      // ── 2b: Upload from imageUrls (server-side download, CDN blocking risk) ──

      if (imageUrls.length > 0) {
        strapi.log.info(
          `[Product CreateWithImages] Downloading ${imageUrls.length} image URL(s) for documentId=${product.documentId}`,
        )
        const tmpDir = os.tmpdir()

        for (const [idx, imageUrl] of imageUrls.entries()) {
          let tmpPath = ''
          try {
            // Alibaba CDN requires browser-like headers; plain fetch() gets blocked
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
              const msg = `HTTP ${resp.status}`
              imageResults.push({ url: imageUrl, ok: false, error: msg })
              strapi.log.warn(
                `[Product CreateWithImages] Image URL returned ${resp.status}: ${imageUrl}`,
              )
              continue
            }

            const buffer = Buffer.from(await resp.arrayBuffer())
            if (buffer.length === 0) {
              imageResults.push({ url: imageUrl, ok: false, error: 'Empty body' })
              continue
            }

            const contentType =
              resp.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
            if (!contentType.startsWith('image/')) {
              imageResults.push({
                url: imageUrl,
                ok: false,
                error: `Not an image: ${contentType}`,
              })
              continue
            }

            const ext = contentType.split('/')[1].replace('jpeg', 'jpg')
            const filename = `n8n_img_${Date.now()}_${idx}.${ext}`
            tmpPath = path.join(tmpDir, filename)

            fs.writeFileSync(tmpPath, buffer)

            await uploadService.upload({
              data: {
                ref: 'api::product.product',
                refId: product.id,
                field: 'images',
              },
              files: {
                filepath: tmpPath,
                originalFilename: filename,
                mimetype: contentType,
                size: buffer.length,
              },
            })

            imageResults.push({ url: imageUrl, ok: true })
            strapi.log.info(
              `[Product CreateWithImages] Uploaded image ${idx + 1}/${imageUrls.length}: ${filename}`,
            )
          } catch (fetchErr: unknown) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
            imageResults.push({ url: imageUrl, ok: false, error: msg })
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

      // ── 2c: Upload from multipart files (legacy mode) ─────────────
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
                  refId: product.id,
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
        populate: ['images', 'metadata', 'product_schema', 'site', 'category', 'tags'],
      })

      ctx.status = 201
      ctx.body = {
        data: populated,
        _imageResults: imageResults.length > 0 ? imageResults : undefined,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Product CreateWithImages] Unexpected error: ${msg}`)
      return ctx.badRequest(msg)
    }
  },
}))
