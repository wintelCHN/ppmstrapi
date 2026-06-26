/**
 * Shared webhook utility.
 *
 * Centralizes build-trigger logic used by content-type lifecycles.
 * When a content entry is updated, the associated Site's build_webhook URL
 * is read and dispatched via fire-and-forget HTTP POST.
 *
 * Uses Node.js built-in fetch (zero dependencies). The POST body contains
 * minimal metadata so deploy platforms (Vercel, Netlify, Cloudflare Pages)
 * can log which site/entry triggered the build.
 */

interface SiteRelation {
  name: string
  build_webhook: string | null
  deploy_platform: string | null
}

export async function logBuildWebhook(
  strapi: any,
  uid: string,
  documentId: string,
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
      }),
      signal: AbortSignal.timeout(10000),
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
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        strapi.log.error(
          `[Webhook] Failed: ${site.build_webhook} | ${message}`,
        )
      })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    strapi.log.error(`[Webhook] Error for ${uid}::${documentId}: ${message}`)
  }
}
