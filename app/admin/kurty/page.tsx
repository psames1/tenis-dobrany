import { createClient } from '@/lib/supabase/server'
import { getOrganization } from '@/lib/organization'
import { redirect } from 'next/navigation'
import CourtManagement from './CourtManagement'

export default async function AdminKurtyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/?error=forbidden')
  }

  const org = await getOrganization()
  if (!org) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Organizace nenalezena.</p>
      </div>
    )
  }

  // Načíst kurty s aktuálními pravidly
  const { data: courts } = await supabase
    .from('app_courts')
    .select('id, name, surface, indoor, active, sort_order')
    .eq('organization_id', org.id)
    .order('sort_order')

  const courtIds = (courts ?? []).map((c: any) => c.id)

  // Aktuální platná pravidla (valid_to IS NULL)
  const { data: rules } = courtIds.length
    ? await supabase
        .from('app_court_reservation_rules')
        .select('court_id, time_from, time_to, slot_minutes, price_member, price_guest, max_advance_days')
        .in('court_id', courtIds)
        .is('valid_to', null)
    : { data: [] }

  const rulesMap = Object.fromEntries(
    (rules ?? []).map((r: any) => [r.court_id, r])
  )

  const courtsWithRules = (courts ?? []).map((c: any) => ({
    ...c,
    rule: rulesMap[c.id] ?? null,
  }))

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Správa kurtů</h1>
        <p className="text-sm text-gray-500 mt-1">{org.name}</p>
      </div>

      <CourtManagement courts={courtsWithRules} organizationId={org.id} />
    </div>
  )
}
