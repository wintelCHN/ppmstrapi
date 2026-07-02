/**
 * Simple in-memory rate limiter for Koa/Strapi controllers.
 *
 * Keys requests by `ctx.request.ip` (falls back to socket remoteAddress).
 * Returns `true` when the request is allowed; sets `ctx.status` / `ctx.body`
 * and returns `false` when the limit is exceeded.
 *
 * NOTE: This is a single-process store. For multi-instance deployments, replace
 * with a Redis-backed limiter.
 */

interface RateLimitOptions {
  windowMs: number
  max: number
  message?: string
}

interface Bucket {
  count: number
  resetTime: number
}

const store = new Map<string, Bucket>()

function getClientIp(ctx: any): string {
  return (
    ctx.request?.ip ??
    ctx.request?.socket?.remoteAddress ??
    ctx.req?.socket?.remoteAddress ??
    'unknown'
  )
}

function getBucket(key: string, windowMs: number): Bucket {
  const now = Date.now()
  const existing = store.get(key)
  if (existing && existing.resetTime > now) {
    return existing
  }
  const bucket: Bucket = { count: 0, resetTime: now + windowMs }
  store.set(key, bucket)
  return bucket
}

export async function rateLimit(
  ctx: any,
  options: RateLimitOptions,
): Promise<boolean> {
  const key = getClientIp(ctx)
  const bucket = getBucket(key, options.windowMs)

  bucket.count += 1

  if (bucket.count > options.max) {
    ctx.status = 429
    ctx.body = {
      data: null,
      error: {
        status: 429,
        message: options.message ?? 'Too many requests, please try again later.',
      },
    }
    return false
  }

  return true
}
