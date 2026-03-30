import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgContext, getOrganization } from '@/lib/organization'
import ReservationGrid, { type Court, type CourtRule, type Reservation } from './ReservationGrid'

// Dnešní datum v Praha timezone jako YYYY-MM-DD
function pragueToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })
}

// Přidat dny k datu YYYY-MM-DD
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// Převod lokálního data + čas (Praha) na UTC ISO
// Používáme Z aby bylo chování konzistentní bez ohledu na TZ serveru/prohlížeče
function pragueToUTC(dateStr: string, timeStr: string): string {
  const probe = new Date(`${dateStr}T${timeStr}:00Z`) // interpret as UTC first
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    timeZoneName: 'shortOffset',
  }).formatToParts(probe).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2'
  const offsetH = parseInt(tz.match(/GMT([+-]\d+)/)?.[1] ?? '2', 10)
  return new Date(probe.getTime() - offsetH * 3_600_000).toISOString()
}

type PageProps = {
  searchParams: Promise<{ datum?: string }>
}

export default async function RezervacePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Autentikace (použij anon klienta — jen session cookies)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/rezervace')

  // Organizace z kontextu (nastaveného middlewarem)
  const orgCtx = getOrgContext()
  const org = await getOrganization()

  if (!org) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Organizace nenalezena</h1>
        <p className="mt-2 text-gray-600">Rezervační systém není dostupný pro tuto stránku.</p>
      </div>
    )
  }

  // Ověřit členství uživatele v organizaci (admin klient = obchází RLS)
  const { data: membership } = await admin
    .from('app_organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Přístup odepřen</h1>
        <p className="mt-2 text-gray-600">Rezervace jsou dostupné pouze pro členy klubu.</p>
      </div>
    )
  }

  // Datum z URL nebo dnes
  const params = await searchParams
  const today = pragueToday()
  const requestedDate = params.datum ?? today
  // Sanitace: datum musí být ve formátu YYYY-MM-DD a nesmí být v minulosti víc než 1 den
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today

  // Načíst aktivní kurty organizace (admin klient = obchází RLS)
  const { data: courtsRaw } = await admin
    .from('app_courts')
    .select('id, name, surface, indoor, sort_order')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('sort_order')

  const courts: Court[] = courtsRaw ?? []

  if (courts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Žádné kurty</h1>
        <p className="mt-2 text-gray-600">Pro tuto organizaci zatím nejsou nastaveny žádné kurty.</p>
      </div>
    )
  }

  const courtIds = courts.map(c => c.id)

  // Načíst pravidla rezervací — platná pro vybraný datum (admin klient)
  const { data: rulesRaw } = await admin
    .from('app_court_reservation_rules')
    .select('court_id, time_from, time_to, slot_minutes, price_member, price_guest, max_advance_days, max_duration_minutes, min_gap_minutes, max_per_week, require_partner')
    .in('court_id', courtIds)
    .lte('valid_from', date)
    .or('valid_to.is.null,valid_to.gte.' + date)
    .order('valid_from', { ascending: false })

  // Pro každý kurt vzít pouze nejnovější platné pravidlo
  const rulesMap = new Map<string, CourtRule>()
  for (const r of (rulesRaw ?? [])) {
    if (!rulesMap.has(r.court_id)) {
      rulesMap.set(r.court_id, {
        courtId: r.court_id,
        timeFrom: r.time_from,
        timeTo: r.time_to,
        slotMinutes: r.slot_minutes,
        priceMember: r.price_member,
        priceGuest: r.price_guest,
        maxAdvanceDays: r.max_advance_days,
        maxDurationMinutes: r.max_duration_minutes ?? 120,
        minGapMinutes: r.min_gap_minutes ?? 0,
        maxPerWeek: r.max_per_week ?? null,
        requirePartner: r.require_partner ?? false,
      })
    }
  }
  const rules: CourtRule[] = Array.from(rulesMap.values())

  // Maximální počet dní dopředu (globální maximum přes všechny kurty)
  const maxAdvanceDays = rules.length > 0
    ? Math.max(...rules.map(r => r.maxAdvanceDays))
    : 14

  // Načíst rezervace pro vybraný den
  const dayStart = pragueToUTC(date, '00:00')
  const dayEnd = pragueToUTC(addDays(date, 1), '00:00')

  const { data: reservationsRaw } = await admin
    .from('app_court_reservations')
    .select(`
      id, court_id, user_id, start_time, end_time,
      status, partner_name, note,
      user_profiles ( full_name )
    `)
    .eq('organization_id', org.id)
    .in('court_id', courtIds)
    .gte('start_time', dayStart)
    .lt('start_time', dayEnd)
    .neq('status', 'cancelled')

  const reservations: Reservation[] = (reservationsRaw ?? []).map((r: any) => ({
    id: r.id,
    courtId: r.court_id,
    userId: r.user_id,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status,
    partnerName: r.partner_name ?? null,
    note: r.note ?? null,
    userFullName: r.user_profiles?.full_name ?? null,
  }))

  // Načíst členy organizace pro napovínací výběr spoluháče
  const { data: membersRaw } = await admin
    .from('app_organization_members')
    .select('user_id, user_profiles(id, full_name)')
    .eq('organization_id', org.id)
    .eq('is_active', true)

  const orgMembers: { id: string; fullName: string }[] = []
  for (const m of (membersRaw ?? [])) {
    const p = (m as any).user_profiles
    if (p?.full_name && p.id !== user.id) {
      orgMembers.push({ id: p.id, fullName: p.full_name })
    }
  }
  orgMembers.sort((a, b) => a.fullName.localeCompare(b.fullName, 'cs'))

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rezervace kurtů</h1>
        <p className="mt-1 text-sm text-gray-500">{org.name}</p>
      </div>

      <ReservationGrid
        organizationId={org.id}
        courts={courts}
        rules={rules}
        initialReservations={reservations}
        initialDate={date}
        maxAdvanceDays={maxAdvanceDays}
        currentUserId={user.id}
        orgMembers={orgMembers}
      />
    </div>
  )
}
