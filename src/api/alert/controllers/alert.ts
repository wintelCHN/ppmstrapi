/**
 * Alert controller — sends email notifications for workflow failures.
 *
 * Auth: Bearer token (same verifyToken logic as product controller).
 * Reuses the same SMTP/nodemailer setup as the Lead module.
 */

import jwt from 'jsonwebtoken'

function reject(ctx: any, status: number, message: string) {
  ctx.status = status
  ctx.body = { data: null, error: { message, status } }
}

async function verifyToken(token: string, strapi: any): Promise<boolean> {
  const adminSecret = strapi.config.get('admin.auth.secret') as string
  try { jwt.verify(token, adminSecret); return true } catch {}
  if (token === adminSecret) return true
  return false
}

export default {
  async sendFailure(ctx: any) {
    const authHeader = ctx.request.header.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }
    const valid = await verifyToken(authHeader.split(' ')[1], strapi)
    if (!valid) {
      return reject(ctx, 401, 'Missing or invalid credentials')
    }

    try {
      const body = ctx.request.body ?? {}
      const { source_url, product_name, error, step, supplier_name } = body

      // Debounce: if error message contains the same key content,
      // we still send — the caller (n8n) controls dedup.
      const notifyEmail = process.env.LEAD_NOTIFY_EMAIL
      const smtpHost = process.env.SMTP_HOST

      if (!notifyEmail || !smtpHost) {
        strapi.log.warn('[Alert] SMTP not configured — logging only.')
        strapi.log.warn(
          `[Alert] Failure: step=${step} url=${source_url} error=${error}`,
        )
        ctx.body = { sent: false, reason: 'SMTP not configured' }
        return
      }

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

      const html = `\
<h2>⚠️ n8n 工作流处理失败</h2>
<table style="border-collapse:collapse;width:100%">
<tr><td style="padding:6px 12px;font-weight:bold">步骤</td><td>${step ?? '-'}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">产品名称</td><td>${product_name ?? '-'}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">供应商</td><td>${supplier_name ?? '-'}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">URL</td><td>${source_url ?? '-'}</td></tr>
<tr><td style="padding:6px 12px;font-weight:bold">错误详情</td><td>${error ?? '-'}</td></tr>
</table>
<p>请检查 Google Sheet 并手动处理。</p>`

      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? 'noreply@b2bcms.com',
        to: notifyEmail,
        subject: `[n8n Alert] 工作流失败 — ${step ?? 'unknown'} — ${product_name ?? source_url ?? '-'}`,
        html,
      })

      strapi.log.info(`[Alert] Email sent to ${notifyEmail} for source_url=${source_url}`)
      ctx.body = { sent: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      strapi.log.error(`[Alert] Failed to send: ${msg}`)
      ctx.body = { sent: false, error: msg }
    }
  },
}
