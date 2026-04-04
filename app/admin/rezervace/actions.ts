'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrganization } from '@/lib/organization'

async function requireOrgAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nepřihlášen')

  const org = await getOrganization()
  if (!org) throw new Error('Organizace nenalezena')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    throw new Error('Nedostatečná oprávnění')
  }

  return { supabase, admin: createAdminClient(), org }
}

/** Uloží nastavení organizace (show_player_names atd.) */
export async function updateOrgReservationSettings(formData: FormData) {
  const { admin, org } = await requireOrgAdmin()

  const showPlayerNames = formData.get('show_player_names') === 'on'

  const currentSettings = (org as any).settings ?? {}
  const newSettings = { ...currentSettings, show_player_names: showPlayerNames }

  const { error } = await admin
    .from('app_organizations')
    .update({ settings: newSettings })
    .eq('id', org.id)

  if (error) return { error: 'Nepodařilo se uložit nastavení.' }

  revalidatePath('/admin/rezervace')
  revalidatePath('/rezervace')
  return { success: true }
}

/** Uloží (nebo nahradí) pravidla rezervací pro daný kurt */
export async function updateCourtRule(courtId: string, formData: FormData) {
  const { supabase, org } = await requireOrgAdmin()

  // Ověřit, že kurt patří do org
  const { data: court } = await supabase
    .from('app_courts')
    .select('id')
    .eq('id', courtId)
    .eq('organization_id', org.id)
    .single()

  if (!court) return { error: 'Kurt nebyl nalezen.' }

  const timeFrom = String(formData.get('time_from') ?? '07:00')
  const timeTo = String(formData.get('time_to') ?? '21:00')
  const slotMinutes = parseInt(String(formData.get('slot_minutes') ?? '60'), 10)
  const priceMember = parseFloat(String(formData.get('price_member') ?? '0'))
  const priceGuest = parseFloat(String(formData.get('price_guest') ?? '0'))
  const maxAdvanceDays = parseInt(String(formData.get('max_advance_days') ?? '14'), 10)
  const maxDurationMinutes = parseInt(String(formData.get('max_duration_minutes') ?? '120'), 10)
  const minGapMinutes = parseInt(String(formData.get('min_gap_minutes') ?? '0'), 10)
  const maxPerWeekRaw = formData.get('max_per_week')
  const maxPerWeek = maxPerWeekRaw ? parseInt(String(maxPerWeekRaw), 10) : null
  const requirePartner = formData.get('require_partner') === 'on'

  if (![30, 60, 90, 120].includes(slotMinutes)) return { error: 'Neplatná délka slotu.' }

  // Validace časů
  if (timeFrom >= timeTo) return { error: 'Čas začátku musí být před koncem provozu.' }
  if (maxAdvanceDays < 1 || maxAdvanceDays > 90) return { error: 'Max. dní dopředu musí být 1–90.' }
  if (maxDurationMinutes < slotMinutes) return { error: 'Max. délka musí být ≥ délce slotu.' }

  // Zneplatnit stávající pravidlo (soft-delete pomocí valid_to)
  await supabase
    .from('app_court_reservation_rules')
    .update({ valid_to: new Date().toISOString().split('T')[0] })
    .eq('court_id', courtId)
    .is('valid_to', null)

  const { error } = await supabase
    .from('app_court_reservation_rules')
    .insert({
      court_id: courtId,
      valid_from: new Date().toISOString().split('T')[0],
      time_from: timeFrom,
      time_to: timeTo,
      slot_minutes: slotMinutes,
      price_member: priceMember,
      price_guest: priceGuest,
      max_advance_days: maxAdvanceDays,
      min_advance_minutes: 0,
      requires_approval: false,
      max_duration_minutes: maxDurationMinutes,
      min_gap_minutes: minGapMinutes,
      max_per_week: maxPerWeek,
      require_partner: requirePartner,
    })

  if (error) return { error: 'Nepodařilo se uložit pravidlo: ' + error.message }

  revalidatePath('/admin/rezervace')
  revalidatePath('/admin/kurty')
  revalidatePath('/rezervace')
  return { success: true }
}
