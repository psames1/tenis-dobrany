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

function parseRulesFromFormData(formData: FormData) {
  const timeFrom = String(formData.get('time_from') ?? '07:00')
  const timeTo = String(formData.get('time_to') ?? '21:00')
  if (timeFrom >= timeTo) throw new Error('Čas začátku musí být před koncem provozu.')

  const slotMinutes = parseInt(String(formData.get('slot_minutes') ?? '60'), 10)
  if (![30, 60, 90, 120].includes(slotMinutes)) throw new Error('Neplatná délka slotu.')

  const maxAdvanceDays = parseInt(String(formData.get('max_advance_days') ?? '14'), 10)
  if (maxAdvanceDays < 1 || maxAdvanceDays > 90) throw new Error('Max. dní dopředu musí být 1–90.')

  const maxDurationMinutes = parseInt(String(formData.get('max_duration_minutes') ?? '120'), 10)
  if (maxDurationMinutes < slotMinutes) throw new Error('Max. délka musí být ≥ délce slotu.')

  const maxPerWeekRaw = String(formData.get('max_per_week') ?? '').trim()

  return {
    time_from: timeFrom,
    time_to: timeTo,
    slot_minutes: slotMinutes,
    price_member: parseFloat(String(formData.get('price_member') ?? '0')) || 0,
    price_guest: parseFloat(String(formData.get('price_guest') ?? '100')) || 0,
    max_advance_days: maxAdvanceDays,
    max_duration_minutes: maxDurationMinutes,
    min_gap_minutes: parseInt(String(formData.get('min_gap_minutes') ?? '0'), 10) || 0,
    max_per_week: maxPerWeekRaw !== '' ? parseInt(maxPerWeekRaw, 10) : null,
    require_partner: formData.get('require_partner') === 'on',
  }
}

async function applyRulesToCourts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courtIds: string[],
  rules: ReturnType<typeof parseRulesFromFormData>,
) {
  const today = new Date().toISOString().split('T')[0]
  for (const courtId of courtIds) {
    await supabase
      .from('app_court_reservation_rules')
      .update({ valid_to: today })
      .eq('court_id', courtId)
      .is('valid_to', null)
    await supabase
      .from('app_court_reservation_rules')
      .insert({ court_id: courtId, valid_from: today, ...rules, min_advance_minutes: 0, requires_approval: false })
  }
}

/**
 * Uloží nastavení oddílu (zobrazení jmen + výchozí pravidla kurtů)
 * a automaticky synchronizuje všechny kurty s use_org_defaults=true.
 */
export async function updateOrgSettings(formData: FormData) {
  const { supabase, admin, org } = await requireOrgAdmin()

  const showPlayerNames = formData.get('show_player_names') === 'on'

  let rules: ReturnType<typeof parseRulesFromFormData>
  try {
    rules = parseRulesFromFormData(formData)
  } catch (e: any) {
    return { error: e.message }
  }

  const currentSettings = (org as any).settings ?? {}
  const newSettings = { ...currentSettings, show_player_names: showPlayerNames, default_court_rules: rules }

  const { error: settingsError } = await admin
    .from('app_organizations')
    .update({ settings: newSettings })
    .eq('id', org.id)

  if (settingsError) return { error: 'Nepodařilo se uložit nastavení.' }

  // Synchronizovat kurty s use_org_defaults=true
  const { data: defaultCourts } = await admin
    .from('app_courts')
    .select('id')
    .eq('organization_id', org.id)
    .eq('use_org_defaults', true)
    .eq('active', true)

  if (defaultCourts && defaultCourts.length > 0) {
    await applyRulesToCourts(supabase, defaultCourts.map(c => c.id), rules)
  }

  revalidatePath('/admin/rezervace')
  revalidatePath('/admin/kurty')
  revalidatePath('/rezervace')
  return { success: true }
}

/**
 * Přepne, zda kurt používá výchozí pravidla oddílu nebo vlastní.
 * Při zapnutí use_org_defaults zkopíruje aktuální org výchozí pravidla do DB kurtu.
 */
export async function setCourtUseDefaults(courtId: string, useDefaults: boolean) {
  const { supabase, admin, org } = await requireOrgAdmin()

  const { data: court } = await supabase
    .from('app_courts')
    .select('id')
    .eq('id', courtId)
    .eq('organization_id', org.id)
    .single()
  if (!court) return { error: 'Kurt nebyl nalezen.' }

  const { error: updateError } = await admin
    .from('app_courts')
    .update({ use_org_defaults: useDefaults })
    .eq('id', courtId)
  if (updateError) return { error: 'Nepodařilo se aktualizovat kurt.' }

  if (useDefaults) {
    const defaultRules = (org as any).settings?.default_court_rules
    if (defaultRules) {
      await applyRulesToCourts(supabase, [courtId], defaultRules)
    }
  }

  revalidatePath('/admin/rezervace')
  revalidatePath('/rezervace')
  return { success: true }
}

/** Uloží vlastní pravidla pro konkrétní kurt (use_org_defaults=false). */
export async function updateCourtRule(courtId: string, formData: FormData) {
  const { supabase, org } = await requireOrgAdmin()

  const { data: court } = await supabase
    .from('app_courts')
    .select('id')
    .eq('id', courtId)
    .eq('organization_id', org.id)
    .single()
  if (!court) return { error: 'Kurt nebyl nalezen.' }

  let rules: ReturnType<typeof parseRulesFromFormData>
  try {
    rules = parseRulesFromFormData(formData)
  } catch (e: any) {
    return { error: e.message }
  }

  await applyRulesToCourts(supabase, [courtId], rules)

  revalidatePath('/admin/rezervace')
  revalidatePath('/admin/kurty')
  revalidatePath('/rezervace')
  return { success: true }
}
