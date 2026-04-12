import { createClient } from '@/lib/supabase/server'
import { getOrganization } from '@/lib/organization'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DomainSettingsForm from './DomainSettingsForm'

export const metadata: Metadata = { title: 'Admin – Vlastní doména' }

export default async function DomainSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/admin?error=forbidden')
  }

  const org = await getOrganization()
  if (!org) redirect('/admin')

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vlastní doména</h1>
      <DomainSettingsForm
        orgId={org.id}
        orgName={org.name}
        orgSlug={org.slug}
        currentDomain={org.custom_domain ?? null}
      />
    </div>
  )
}
