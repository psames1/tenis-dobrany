import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from './encryption'

interface MailConfig {
  transporter: Transporter
  from: string
}

/**
 * Build SMTP config for an organization.
 * If the org has smtp_enabled + valid config → use it.
 * Otherwise → fallback to DEFAULT_SMTP_* env vars.
 */
export async function getMailConfig(orgId?: string): Promise<MailConfig> {
  // Try org-specific SMTP first
  if (orgId) {
    try {
      const admin = createAdminClient()
      const { data: org } = await admin
        .from('app_organizations')
        .select('smtp_enabled, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_name, smtp_from_email')
        .eq('id', orgId)
        .single()

      if (org?.smtp_enabled && org.smtp_host && org.smtp_user && org.smtp_password) {
        const password = decrypt(org.smtp_password)
        const transporter = nodemailer.createTransport({
          host: org.smtp_host,
          port: org.smtp_port ?? 465,
          secure: (org.smtp_port ?? 465) === 465,
          auth: { user: org.smtp_user, pass: password },
        })
        const fromName = org.smtp_from_name ?? org.smtp_user
        const fromEmail = org.smtp_from_email ?? org.smtp_user
        return {
          transporter,
          from: `${fromName} <${fromEmail}>`,
        }
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Fallback: default SMTP from env
  return getDefaultMailConfig()
}

/** Build SMTP config from DEFAULT_SMTP_* env vars */
export function getDefaultMailConfig(): MailConfig {
  const host = process.env.DEFAULT_SMTP_HOST ?? process.env.SMTP_HOST ?? 'localhost'
  const port = parseInt(process.env.DEFAULT_SMTP_PORT ?? process.env.SMTP_PORT ?? '1025', 10)
  const user = process.env.DEFAULT_SMTP_USER ?? process.env.SMTP_USER
  const pass = process.env.DEFAULT_SMTP_PASS ?? process.env.SMTP_PASS
  const secure = port === 465

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  })

  const fromName = process.env.DEFAULT_SMTP_FROM_NAME ?? 'SportKalendář'
  const fromEmail = process.env.DEFAULT_SMTP_FROM_EMAIL ?? process.env.SMTP_FROM ?? user ?? 'noreply@sportkalendar.cz'

  return {
    transporter,
    from: `${fromName} <${fromEmail}>`,
  }
}

/**
 * Send email via the correct SMTP (org-specific or default).
 */
export async function sendEmail({
  to,
  bcc,
  subject,
  html,
  orgId,
}: {
  to: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
  orgId?: string
}): Promise<{ success: boolean; error?: string; from?: string }> {
  try {
    const config = await getMailConfig(orgId)
    await config.transporter.sendMail({ from: config.from, to, bcc, subject, html })
    return { success: true, from: config.from }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nepodařilo se odeslat email'
    console.error('[mailer] sendEmail error:', message)
    return { success: false, error: message }
  }
}
