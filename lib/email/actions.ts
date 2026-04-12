'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrganization } from '@/lib/organization'
import { sendEmail, getMailConfig, getDefaultMailConfig } from '@/lib/email/mailer'
import { encrypt } from '@/lib/email/encryption'
import { buildTestEmailHtml, buildInvitationEmailHtml } from '@/lib/email/templates'

async function requireManagerOrAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nepřihlášen')
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    throw new Error('Nedostatečná oprávnění')
  }
  return { user, role: profile.role as string }
}

// ─── Uložit SMTP nastavení organizace ────────────────────────────────────────

export async function saveOrgSmtpSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await requireManagerOrAdmin()
    const org = await getOrganization()
    if (!org) return { success: false, error: 'Organizace nenalezena' }

    const enabled = formData.get('smtp_enabled') === '1'
    const host = (formData.get('smtp_host') as string)?.trim() ?? ''
    const port = parseInt(formData.get('smtp_port') as string, 10) || 465
    const user = (formData.get('smtp_user') as string)?.trim() ?? ''
    const password = (formData.get('smtp_password') as string) ?? ''
    const fromName = (formData.get('smtp_from_name') as string)?.trim() ?? ''
    const fromEmail = (formData.get('smtp_from_email') as string)?.trim() ?? ''

    const admin = createAdminClient()

    const update: Record<string, unknown> = {
      smtp_enabled: enabled,
      smtp_host: host || null,
      smtp_port: port,
      smtp_user: user || null,
      smtp_from_name: fromName || null,
      smtp_from_email: fromEmail || null,
    }

    // Only update password if provided (non-empty means user typed a new one)
    if (password) {
      update.smtp_password = encrypt(password)
    }

    const { error } = await admin
      .from('app_organizations')
      .update(update)
      .eq('id', org.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Neočekávaná chyba' }
  }
}

// ─── Odeslat testovací email ─────────────────────────────────────────────────

export async function sendTestEmail(
  to: string,
  useOrgSmtp: boolean,
): Promise<{ success: boolean; error?: string; sentFrom?: string }> {
  try {
    await requireManagerOrAdmin()
    const org = await getOrganization()
    const siteName = org?.name ?? 'SportKalendář'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sportkalendar.cz'

    // Determine which config to use
    const orgId = useOrgSmtp && org?.id ? org.id : undefined
    const config = orgId ? await getMailConfig(orgId) : getDefaultMailConfig()

    const html = buildTestEmailHtml({
      siteName,
      siteUrl,
      smtpType: orgId ? 'org' : 'default',
    })

    const result = await sendEmail({
      to,
      subject: `[TEST] Email z ${siteName}`,
      html,
      orgId,
    })

    return {
      success: result.success,
      error: result.error,
      sentFrom: config.from,
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Neočekávaná chyba' }
  }
}

// ─── Odeslat pozvánku do klubu ───────────────────────────────────────────────

export async function sendClubInvitation(
  to: string,
  inviterName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const org = await getOrganization()
    const siteName = org?.name ?? 'SportKalendář'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sportkalendar.cz'
    const loginUrl = `${siteUrl}/login`

    const html = buildInvitationEmailHtml({
      siteName,
      siteUrl,
      inviterName,
      loginUrl,
    })

    return await sendEmail({
      to,
      subject: `Pozvánka do ${siteName}`,
      html,
      orgId: org?.id,
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Neočekávaná chyba' }
  }
}
