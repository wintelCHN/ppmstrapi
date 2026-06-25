/**
 * Product custom controller.
 *
 * Extends the core controller with:
 * - batchUpdate        — POST /api/products/batch-update (admin auth via JWT)
 * - createWithImages   — POST /api/products/create-with-images (admin auth via JWT)
 */

import { factories } from '@strapi/strapi'
import jwt from 'jsonwebtoken'

function reject(ctx: any, status: number, message: string) {
  ctx.status = status
  ctx.body = { data: null, error: { message, status } }
}

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  /**
   * POST /api/products/batch-update
   *
   * Body: { data: { documentIds: string[], data: { site?, category?, moq? } } }
   *
   * Updates site, category, and/or MOQ for a batch of products.
   * Admin JWT is verified inline (route uses auth: false to bypass
   * default content-api users-permissions auth which rejects admin tokens).
   */
  async batchUpdate(ctx: any) {
    // ── Admin JWT verification ────────────────────────────────────────
    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }
    try {
      const secret = strapi.config.get<string>('admin.auth.secret')
      jwt.verify(authHeader.split(' ')[1], secret)
    } catch {
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
   * Accepts multipart/form-data with:
   *   - data  (string) — JSON-encoded product fields
   *   - files (file[]) — one or more image files (field name: "files.images")
   *
   * Strapi v5 no longer supports uploading files during entry creation in a
   * single request via the standard REST API. This endpoint bridges that gap
   * by performing the two steps internally:
   *   1. Create the product entry via strapi.documents()
   *   2. Upload each image via the upload plugin with ref/refId/field so the
   *      files are immediately associated with the new product's "images" field
   *
   * Admin JWT is verified inline (route uses auth: false to bypass the default
   * content-api users-permissions auth which rejects admin tokens).
   *
   * n8n usage:
   *   POST /api/products/create-with-images
   *   Authorization: Bearer <admin-jwt>
   *   Content-Type: multipart/form-data
   *   Body:
   *     data        = '{"name":"Widget","price":9.99,...}'
   *     files.images = <binary file(s)>
   */
  async createWithImages(ctx: any) {
    // ── Admin JWT verification ────────────────────────────────────────
    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }
    try {
      const secret = strapi.config.get<string>('admin.auth.secret')
      jwt.verify(authHeader.split(' ')[1], secret)
    } catch {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      // ── Parse multipart body ────────────────────────────────────────
      // Strapi's Koa middleware parses multipart automatically.
      // ctx.request.body  → text fields
      // ctx.request.files → uploaded files (keyed by field name)
      const rawData = ctx.request.body?.data ?? ctx.request.body ?? {}
      const productData: Record<string, any> =
        typeof rawData === 'string' ? JSON.parse(rawData) : rawData

      if (!productData.name) {
        return ctx.badRequest('Product name is required')
      }

      // ── Step 1: Create the product entry ────────────────────────────
      const product = await strapi.documents('api::product.product').create({
        data: productData,
        populate: ['images'],
      })

      strapi.log.info(
        `[Product CreateWithImages] Created product documentId=${product.documentId} name="${product.name}"`,
      )

      // ── Step 2: Upload images and associate them ─────────────────────
      // Files may arrive under "files.images" (n8n multipart field name)
      // or simply "files" as a fallback.
      const files = ctx.request.files as Record<string, any> | undefined

      if (files && Object.keys(files).length > 0) {
        const uploadService = strapi.plugins.upload.services.upload

        // Collect all file objects regardless of the field key used by the client.
        // Support both "files.images" (preferred) and any other key.
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
            `[Product CreateWithImages] Uploading ${imageFiles.length} image(s) for documentId=${product.documentId}`,
          )

          // Upload each file individually so we can capture its media ID.
          // The upload service associates the file with the entry when
          // ref / refId / field are provided.
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
              // Continue uploading remaining files rather than aborting the whole request
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
