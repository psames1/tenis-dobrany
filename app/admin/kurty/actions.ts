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

export async function createCourt(formData: FormData) {
  const { supabase, org } = await requireOrgAdmin()

  const name = String(formData.get('name') ?? '').trim()
  const surface = String(formData.get('surface') ?? 'clay')
  const indoor = formData.get('indoor') === 'on'

  if (!name) return { error: 'Název kurtu je povinný.' }
  if (!['clay', 'hard', 'grass', 'indoor_hard'].includes(surface)) {
    return { error: 'Neplatný povrch.' }
  }

  // Určit pořadí — za poslední kurt
  const { data: last } = await supabase
    .from('app_courts')
    .select('sort_order')
    .eq('organization_id', org.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (last?.sort_order ?? 0) + 1

  const { error } = await supabase
    .from('app_courts')
    .insert({ organization_id: org.id, name, surface, indoor, active: true, sort_order: sortOrder })

  if (error) return { error: 'Nepodařilo se vytvořit kurt.' }

  revalidatePath('/admin/kurty')
  return { success: true }
}

export async function toggleCourtActive(courtId: string, active: boolean) {
  const { supabase, org } = await requireOrgAdmin()

  const { error } = await supabase
    .from('app_courts')
    .update({ active })
    .eq('id', courtId)
    .eq('organization_id', org.id)

  if (error) return { error: 'Nepodařilo se aktualizovat kurt.' }

  revalidatePath('/admin/kurty')
  return { success: true }
}

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

  // Zneplatnit stávající pravidlo a vytvořit nové
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

  if (error) return { error: 'Nepodařilo se uložit pravidlo.' }

  revalidatePath('/admin/kurty')
  return { success: true }
}

export async function setCourtUseDefaults(courtId: string, useDefaults: boolean) {
  const { supabase, admin, org } = await requireOrgAdmin()

  const { data: court } = await supabase
    .from('app_courts')
    .select('id')
    .eq('id', courtId)
    .eq('organization_id', org.id)
    .single()
  if (!court) return { error: 'Kurt nebyl nalezen.' }

  const { error } = await admin
    .from('app_courts')
    .update({ use_org_defaults: useDefaults })
    .eq('id', courtId)
  if (error) return { error: 'Nepodařilo se aktualizovat kurt.' }

  revalidatePath('/admin/kurty')
  revalidatePath('/admin/rezervace')
  revalidatePath('/rezervace')
  return { success: true }
}

export async function deleteCourt(courtId: string) {
  const { supabase, org } = await requireOrgAdmin()

  // Ověřit, že kurt patří do org a je neaktivní
  const { data: court } = await supabase
    .from('app_courts')
    .select('id, active')
    .eq('id', courtId)
    .eq('organization_id', org.id)
    .single()

  if (!court) return { error: 'Kurt nebyl nalezen.' }
  if (court.active) return { error: 'Nelze smazat aktivní kurt. Nejprve ho deaktivujte.' }

  // Zkontrolovat budoucí potvrzené rezervace
  const { data: futureRes } = await supabase
    .from('app_court_reservations')
    .select('id')
    .eq('court_id', courtId)
    .neq('status', 'cancelled')
    .gte('start_time', new Date().toISOString())
    .limit(1)

  if (futureRes && futureRes.length > 0) {
    return { error: 'Kurt má budoucí potvrzené rezervace. Nejprve je zrušte.' }
  }

  const { error } = await supabase
    .from('app_courts')
    .delete()
    .eq('id', courtId)
    .eq('organization_id', org.id)

  if (error) return { error: 'Nepodařilo se smazat kurt: ' + error.message }

  revalidatePath('/admin/kurty')
  revalidatePath('/admin/rezervace')
  revalidatePath('/rezervace')
  return { success: true }
}
