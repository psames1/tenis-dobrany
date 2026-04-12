import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminShell } from './AdminShell'
import { getOrganization } from '@/lib/organization'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/admin')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/?error=forbidden')
  }

  const org = await getOrganization()

  return (
    <AdminShell role={profile.role} name={profile.full_name ?? profile.email ?? ''} orgName={org?.name ?? null}>
      {children}
    </AdminShell>
  )
}
