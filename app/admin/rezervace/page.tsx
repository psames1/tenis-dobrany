import { createClient } from '@/lib/supabase/server'
import { getOrganization } from '@/lib/organization'
import { redirect } from 'next/navigation'
import ReservationSettings from './ReservationSettings'

export default async function AdminRezervaceNastaveniPage() {
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

  // Načíst všechny kurty včetně use_org_defaults
  const { data: courts } = await supabase
    .from('app_courts')
    .select('id, name, surface, indoor, active, sort_order, use_org_defaults')
    .eq('organization_id', org.id)
    .order('sort_order')

  // Vlastní pravidla načíst jen pro kurty s use_org_defaults=false
  const customCourtIds = (courts ?? [])
    .filter((c: any) => c.use_org_defaults === false)
    .map((c: any) => c.id)

  const { data: rules } = customCourtIds.length
    ? await supabase
        .from('app_court_reservation_rules')
        .select('court_id, time_from, time_to, slot_minutes, price_member, price_guest, max_advance_days, max_duration_minutes, min_gap_minutes, max_per_week, require_partner')
        .in('court_id', customCourtIds)
        .is('valid_to', null)
    : { data: [] }

  const rulesMap = Object.fromEntries((rules ?? []).map((r: any) => [r.court_id, r]))

  const courtsWithRules = (courts ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    surface: c.surface,
    indoor: c.indoor,
    active: c.active,
    sort_order: c.sort_order,
    useOrgDefaults: c.use_org_defaults !== false,
    rule: c.use_org_defaults === false ? (rulesMap[c.id] ?? null) : null,
  }))

  const orgSettings = (org as any).settings ?? {}
  const orgDefaultRules = orgSettings.default_court_rules ?? null

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nastavení rezervací kurtů</h1>
        <p className="text-sm text-gray-500 mt-1">{org.name}</p>
      </div>

      <ReservationSettings
        orgSettings={orgSettings}
        orgDefaultRules={orgDefaultRules}
      />
    </div>
  )
}
