'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrganization, getOrgContext } from '@/lib/organization'

export type CreateReservationInput = {
  courtId: string
  organizationId: string
  startTimeISO: string  // UTC ISO string sestavený v klientu z Praha timezone
  endTimeISO: string
  partnerName?: string
  note?: string
}

export type ReservationActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

/**
 * Vytvoří novou rezervaci kurtu.
 * Trigger v DB zabrání překrytí — chybu zachytíme a vrátíme uživateli.
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<ReservationActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Pro rezervaci se musíte přihlásit.' }
  }

  // Ověřit, že uživatel je aktivní člen organizace
  const { data: membership } = await supabase
    .from('app_organization_members')
    .select('role')
    .eq('organization_id', input.organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) {
    return { success: false, error: 'Nemáte oprávnění rezervovat v této organizaci.' }
  }

  // Ověřit, že kurt patří do organizace
  const { data: court } = await supabase
    .from('app_courts')
    .select('id')
    .eq('id', input.courtId)
    .eq('organization_id', input.organizationId)
    .eq('active', true)
    .single()

  if (!court) {
    return { success: false, error: 'Kurt nebyl nalezen.' }
  }

  // Validace časů
  const startTime = new Date(input.startTimeISO)
  const endTime = new Date(input.endTimeISO)

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return { success: false, error: 'Neplatný čas rezervace.' }
  }

  if (endTime <= startTime) {
    return { success: false, error: 'Čas konce musí být po začátku.' }
  }

  if (startTime < new Date()) {
    return { success: false, error: 'Nelze rezervovat čas v minulosti.' }
  }

  // Vložit rezervaci — DB trigger zabrání kolizi
  const { data, error } = await supabase
    .from('app_court_reservations')
    .insert({
      court_id: input.courtId,
      organization_id: input.organizationId,
      user_id: user.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'confirmed',
      price: 0,  // pro členy zdarma — v budoucnu z pravidel
      partner_name: input.partnerName?.trim() || null,
      note: input.note?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    // DB trigger vrátí zprávu začínající "OVERLAP:"
    if (error.message.includes('OVERLAP') || error.code === '23514') {
      return { success: false, error: 'Zvolený čas je již obsazený. Vyberte jiný termín.' }
    }
    console.error('createReservation error:', error)
    return { success: false, error: 'Rezervaci se nepodařilo uložit. Zkuste to prosím znovu.' }
  }

  revalidatePath('/rezervace')
  return { success: true, id: data.id }
}

export type CancelReservationResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Zruší rezervaci.
 * Vlastní rezervaci může zrušit kdokoli, cizí jen admin/manager.
 */
export async function cancelReservation(
  reservationId: string
): Promise<CancelReservationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Pro zrušení rezervace se musíte přihlásit.' }
  }

  // Načíst rezervaci (RLS zajistí viditelnost pouze pro členy organizace)
  const { data: reservation } = await supabase
    .from('app_court_reservations')
    .select('id, user_id, start_time, status, organization_id')
    .eq('id', reservationId)
    .single()

  if (!reservation) {
    return { success: false, error: 'Rezervace nebyla nalezena.' }
  }

  if (reservation.status === 'cancelled') {
    return { success: false, error: 'Rezervace je již zrušená.' }
  }

  // Zkontrolovat, zda rezervace není v minulosti
  if (new Date(reservation.start_time) < new Date()) {
    return { success: false, error: 'Nelze zrušit proběhlou rezervaci.' }
  }

  // Kontrola oprávnění: vlastní rezervace nebo admin/manager
  if (reservation.user_id !== user.id) {
    const { data: membership } = await supabase
      .from('app_organization_members')
      .select('role')
      .eq('organization_id', reservation.organization_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership || !['admin', 'manager'].includes(membership.role)) {
      return { success: false, error: 'Nemáte oprávnění zrušit tuto rezervaci.' }
    }
  }

  const { error } = await supabase
    .from('app_court_reservations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
    })
    .eq('id', reservationId)

  if (error) {
    console.error('cancelReservation error:', error)
    return { success: false, error: 'Zrušení rezervace se nepodařilo. Zkuste to prosím znovu.' }
  }

  revalidatePath('/rezervace')
  return { success: true }
}
