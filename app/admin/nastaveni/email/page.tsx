import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrganization } from '@/lib/organization'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import EmailSettingsForm from './EmailSettingsForm'

export const metadata: Metadata = { title: 'Admin – Nastavení emailu' }

export default async function EmailSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/admin?error=forbidden')
  }

  // Load org SMTP settings (sans password)
  const org = await getOrganization()
  let orgSmtp = null

  if (org) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('app_organizations')
      .select('smtp_enabled, smtp_host, smtp_port, smtp_user, smtp_from_name, smtp_from_email')
      .eq('id', org.id)
      .single()
    orgSmtp = data
  }

  // Default SMTP info (only reveal to admin, never expose passwords)
  const defaultSmtp = profile.role === 'admin' ? {
    host: process.env.DEFAULT_SMTP_HOST ?? process.env.SMTP_HOST ?? '(nenastaveno)',
    port: process.env.DEFAULT_SMTP_PORT ?? process.env.SMTP_PORT ?? '(nenastaveno)',
    user: process.env.DEFAULT_SMTP_USER ?? process.env.SMTP_USER ?? '(nenastaveno)',
    fromName: process.env.DEFAULT_SMTP_FROM_NAME ?? 'SportKalendář',
    fromEmail: process.env.DEFAULT_SMTP_FROM_EMAIL ?? process.env.SMTP_FROM ?? '(nenastaveno)',
  } : null

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nastavení emailu</h1>
      <EmailSettingsForm
        userEmail={profile.email ?? user.email ?? ''}
        userRole={profile.role}
        orgName={org?.name ?? null}
        orgId={org?.id ?? null}
        defaultSmtp={defaultSmtp}
        orgSmtp={orgSmtp}
      />
    </div>
  )
}
