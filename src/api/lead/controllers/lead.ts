/**
 * Lead controller.
 *
 * - Core CRUD actions via factories.createCoreController (admin use).
 * - Custom createPublic action for POST /api/public/lead (public, no auth).
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::lead.lead', ({ strapi }) => ({
  /**
   * Public lead submission endpoint.
   *
   * Validates payload, checks spam (honeypot), enforces rate limit,
   * auto-captures IP/User-Agent, creates the lead, and fires an async
   * email notification.
   */
  async createPublic(ctx: any) {
    const payload = ctx.request.body?.data ?? ctx.request.body ?? {}

    const leadService = strapi.service('api::lead.lead') as any

    // 1. Validate payload
    const validation = leadService.validate(payload)
    if (!validation.valid) {
      return ctx.badRequest({
        success: false,
        message: validation.message,
      })
    }

    // 2. Honeypot spam check
    if (leadService.isSpam(payload)) {
      // Return 200 fake success – don't reveal spam detection
      return { success: true, message: 'Lead submitted successfully.' }
    }

    // 3. Rate limit check
    const clientIp = ctx.request.ip ?? 'unknown'
    if (!leadService.checkRateLimit(clientIp)) {
      return ctx.tooManyRequests({
        success: false,
        message: 'Too many requests. Please try again later.',
      })
    }

    // 4. Build lead data (auto-capture technical fields)
    const leadData = {
      name: payload.name?.trim(),
      email: payload.email?.trim().toLowerCase(),
      phone: payload.phone?.trim() || undefined,
      whatsapp: payload.whatsapp?.trim() || undefined,
      company: payload.company?.trim() || undefined,
      country: payload.country?.trim() || undefined,
      message: payload.message?.trim(),
      product_interest: payload.product_interest?.trim() || undefined,
      quantity: payload.quantity?.trim() || undefined,
      site_id: payload.site_id?.trim(),
      site_domain: payload.site_domain?.trim(),
      page_url: payload.page_url?.trim(),
      page_title: payload.page_title?.trim() || undefined,
      utm_source: payload.utm_source || undefined,
      utm_medium: payload.utm_medium || undefined,
      utm_campaign: payload.utm_campaign || undefined,
      utm_term: payload.utm_term || undefined,
      utm_content: payload.utm_content || undefined,
      ip_address: clientIp,
      user_agent: (ctx.request.headers['user-agent'] ?? '').slice(0, 1000),
      status: 'new' as const,
    }

    try {
      // 5. Create lead
      const lead = await strapi.documents('api::lead.lead').create({ data: leadData })

      // 6. Fire-and-forget email notification
      leadService.sendNotification(lead).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        strapi.log.error(`[Lead] Notification failed: ${message}`)
      })

      strapi.log.info(`[Lead] New lead created: ${leadData.email} | site=${leadData.site_id}`)

      return { success: true, message: 'Lead submitted successfully.' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      strapi.log.error(`[Lead] Create failed: ${message}`)
      return ctx.internalServerError({
        success: false,
        message: 'Internal server error.',
      })
    }
  },

  /**
   * CSV export (admin only, authenticated via core policy).
   */
  async export(ctx: any) {
    try {
      const leads = await strapi.documents('api::lead.lead').findMany({
        limit: 10000,
        sort: 'createdAt:desc',
      })

      const headers = ['Created At', 'Name', 'Email', 'Phone', 'Company', 'Country', 'Message', 'Site', 'Status']
      const rows = leads.map((l: Record<string, unknown>) => [
        l.createdAt ?? '',
        (l.name ?? '') as string,
        (l.email ?? '') as string,
        (l.phone ?? '') as string,
        (l.company ?? '') as string,
        (l.country ?? '') as string,
        ((l.message ?? '') as string).replace(/"/g, '""'),
        (l.site_id ?? '') as string,
        (l.status ?? 'new') as string,
      ])

      const csv = [
        headers.map((h: string) => `"${h}"`).join(','),
        ...rows.map((r: string[]) => r.map((c: string) => `"${c}"`).join(',')),
      ].join('\n')

      ctx.set('Content-Type', 'text/csv; charset=utf-8')
      ctx.set('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`)
      ctx.send(csv)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      strapi.log.error(`[Lead] Export failed: ${message}`)
      return ctx.internalServerError({ success: false, message: 'Export failed.' })
    }
  },
}))
