/**
 * Shared webhook utility.
 *
 * Centralizes build-trigger logic used by content-type lifecycles.
 * When a content entry is updated, the associated Site's build_webhook URL
 * is read and dispatched via fire-and-forget HTTP POST.
 *
 * Features:
 * - Per-site cooldown (default 2 minutes) to avoid duplicate builds when editors
 *   save multiple times in succession.
 * - Failed dispatches clear the cooldown so the next change can retry immediately.
 * - Minimal POST body so deploy platforms (Vercel, Netlify, Cloudflare Pages)
 *   can log which site/entry triggered the build.
 *
 * Uses Node.js built-in fetch (zero dependencies).
 */

interface SiteRelation {
  name: string
  build_webhook: string | null
  deploy_platform: string | null
}

/** Cooldown tracking: site name → last trigger timestamp (ms). */
const buildCooldowns = new Map<string, number>()

/** Default cooldown between builds for the same site. */
const DEFAULT_COOLDOWN_MS = 120_000 // 2 minutes

/** Read cooldown from env or fall back to default. */
function getCooldownMs(): number {
  const env = process.env.BUILD_WEBHOOK_COOLDOWN_MS
  if (!env) return DEFAULT_COOLDOWN_MS
  const parsed = Number.parseInt(env, 10)
  return Number.isNaN(parsed) ? DEFAULT_COOLDOWN_MS : Math.max(0, parsed)
}

/**
 * Triggers a build webhook for the site associated with a content entry.
 *
 * @param strapi - Strapi global instance
 * @param uid - Content type UID (e.g. 'api::product.product')
 * @param documentId - Document ID of the updated entry
 * @param options.force - Bypass cooldown (useful for manual rebuild buttons)
 */
export async function logBuildWebhook(
  strapi: any,
  uid: string,
  documentId: string,
  options?: { force?: boolean },
): Promise<void> {
  try {
    const entry = await strapi.documents(uid).findOne({
      documentId,
      populate: ['site'],
    })

    if (!entry) {
      strapi.log.warn(`[Webhook] Entry not found: ${uid}::${documentId}`)
      return
    }

    const site = (entry as Record<string, unknown>).site as SiteRelation | null

    if (!site?.build_webhook) {
      strapi.log.info(
        `[Webhook] No build_webhook configured for ${uid}::${documentId} | site=${site?.name ?? 'unknown'}`,
      )
      return
    }

    const platform = site.deploy_platform ?? 'unknown'
    const cooldownMs = getCooldownMs()
    const now = Date.now()
    const lastTrigger = buildCooldowns.get(site.name)

    if (!options?.force && lastTrigger && now - lastTrigger < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastTrigger)) / 1000)
      strapi.log.info(
        `[Webhook] Build throttled for ${site.name} | ${remaining}s remaining`,
      )
      return
    }

    // Mark as triggered immediately so concurrent saves don't fire multiple hooks.
    buildCooldowns.set(site.name, now)

    strapi.log.info(
      `[Webhook] Triggering ${platform} build for ${site.name} | ${uid}::${documentId}`,
    )

    // Fire-and-forget: do NOT await — the .then/.catch chain runs independently.
    // The admin response returns immediately; webhook dispatch happens in the background.
    fetch(site.build_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: site.name,
        entry: uid,
        documentId,
        deployPlatform: platform,
        triggeredAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15000),
    })
      .then((res) => {
        if (res.ok) {
          strapi.log.info(
            `[Webhook] ${platform}: ${site.build_webhook} -> ${res.status}`,
          )
        } else {
          strapi.log.warn(
            `[Webhook] ${platform}: ${site.build_webhook} -> ${res.status} ${res.statusText}`,
          )
          // Allow retry on next content change if the platform returned an error.
          buildCooldowns.delete(site.name)
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        strapi.log.error(
          `[Webhook] Failed: ${site.build_webhook} | ${message}`,
        )
        // Clear cooldown so the next save retries immediately.
        buildCooldowns.delete(site.name)
      })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    strapi.log.error(`[Webhook] Error for ${uid}::${documentId}: ${message}`)
  }
}
