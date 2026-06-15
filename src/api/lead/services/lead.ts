/**
 * Lead service — business logic for lead submissions.
 *
 * - Payload validation
 * - Spam detection (honeypot)
 * - Rate limiting (in-memory, 5 req / 10 min / IP)
 * - Email notification dispatch
 */

import { factories } from '@strapi/strapi'

interface LeadPayload {
  name?: string
  email?: string
  message?: string
  site_id?: string
  site_domain?: string
  page_url?: string
  website?: string
  [key: string]: unknown
}

interface ValidationResult {
  valid: boolean
  message?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

/** In-memory rate limit store. Resets on server restart. */
const rateLimitStore = new Map<string, RateLimitEntry>()

/** Default config — can be overridden via plugin config later. */
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

export default factories.createCoreService('api::lead.lead', ({ strapi }) => ({

  /**
   * Validate a lead submission payload.
   * Returns { valid: true } or { valid: false, message: "..." }.
   */
  validate(payload: LeadPayload): ValidationResult {
    // Name: required, min 2 chars
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
      return { valid: false, message: 'Name is required (minimum 2 characters).' }
    }

    // Email: required, valid format
    if (!payload.email || typeof payload.email !== 'string') {
      return { valid: false, message: 'Email is required.' }
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(payload.email.trim())) {
      return { valid: false, message: 'Invalid email address.' }
    }

    // Message: required, min 10 chars
    if (!payload.message || typeof payload.message !== 'string' || payload.message.trim().length < 10) {
      return { valid: false, message: 'Message is required (minimum 10 characters).' }
    }

    // Site ID: required
    if (!payload.site_id || typeof payload.site_id !== 'string' || !payload.site_id.trim()) {
      return { valid: false, message: 'Site ID is required.' }
    }

    // Site Domain: required
    if (!payload.site_domain || typeof payload.site_domain !== 'string' || !payload.site_domain.trim()) {
      return { valid: false, message: 'Site domain is required.' }
    }

    return { valid: true }
  },

  /**
   * Honeypot check.
   * The `website` field is hidden from real users via CSS.
   * If it's populated, a bot filled it → treat as spam.
   */
  isSpam(payload: LeadPayload): boolean {
    if (payload.website && String(payload.website).trim().length > 0) {
      strapi.log.warn(`[Lead] Honeypot triggered — submission rejected as spam`)
      return true
    }
    return false
  },

  /**
   * In-memory rate limit check.
   * Returns true if the request is within limits, false if rate-limited.
   */
  checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const entry = rateLimitStore.get(ip)

    if (!entry || now > entry.resetTime) {
      // First request or window expired — reset
      rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
      return true
    }

    if (entry.count >= RATE_LIMIT_MAX) {
      strapi.log.warn(`[Lead] Rate limit exceeded for IP: ${ip}`)
      return false
    }

    entry.count++
    return true
  },

  /**
   * Send email notification for a new lead.
   * Uses nodemailer with SMTP config from environment variables.
   * Fails silently — notification failure should not block lead creation.
   */
  async sendNotification(lead: Record<string, unknown>): Promise<void> {
    const notifyEmail = process.env.LEAD_NOTIFY_EMAIL
    if (!notifyEmail) {
      strapi.log.info('[Lead] LEAD_NOTIFY_EMAIL not configured — skipping notification.')
      return
    }

    const smtpHost = process.env.SMTP_HOST
    if (!smtpHost) {
      strapi.log.info('[Lead] SMTP_HOST not configured — skipping notification.')
      return
    }

    try {
      // Dynamic import — nodemailer is ESM-compatible
      const nodemailer = await import('nodemailer')

      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })

      const siteId = lead.site_id ?? 'unknown'
      const created = (lead.createdAt as string) ?? new Date().toISOString()

      const html = `
<h2>New Lead Received</h2>
<table style="border-collapse:collapse;width:100%;max-width:600px">
  <tr><td style="padding:6px 12px;font-weight:bold;width:120px">Name</td><td>${lead.name ?? ''}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Email</td><td>${lead.email ?? ''}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Phone</td><td>${lead.phone ?? '-'}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Company</td><td>${lead.company ?? '-'}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Country</td><td>${lead.country ?? '-'}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Product</td><td>${lead.product_interest ?? '-'}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Quantity</td><td>${lead.quantity ?? '-'}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Message</td><td>${lead.message ?? ''}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Site</td><td>${lead.site_id ?? ''} (${lead.site_domain ?? ''})</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Page URL</td><td>${lead.page_url ?? ''}</td></tr>
  <tr><td style="padding:6px 12px;font-weight:bold">Created</td><td>${created}</td></tr>
</table>
`.trim()

      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? 'noreply@b2bcms.com',
        to: notifyEmail,
        subject: `New Lead Received — ${siteId}`,
        html,
      })

      strapi.log.info(`[Lead] Notification sent to ${notifyEmail}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      strapi.log.error(`[Lead] Email send failed: ${message}`)
    }
  },
}))
