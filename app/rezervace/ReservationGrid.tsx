'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReservationDialog, { type DialogData } from './ReservationDialog'

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

export type Court = {
  id: string
  name: string
  surface: string
  indoor: boolean
  sort_order: number
}

export type CourtRule = {
  courtId: string
  timeFrom: string   // "07:00"
  timeTo: string     // "21:00"
  slotMinutes: number
  priceMember: number
  priceGuest: number
  maxAdvanceDays: number
}

export type Reservation = {
  id: string
  courtId: string
  userId: string
  startTime: string  // UTC ISO
  endTime: string    // UTC ISO
  status: string
  partnerName: string | null
  note: string | null
  userFullName: string | null
}

type Props = {
  organizationId: string
  courts: Court[]
  rules: CourtRule[]
  initialReservations: Reservation[]
  initialDate: string     // YYYY-MM-DD (Praha tz)
  maxAdvanceDays: number  // globální maximum pro navigaci
  currentUserId: string
}

type TimeSlot = { start: string; end: string }
type SlotState = 'free' | 'mine' | 'taken' | 'past'

// ---------------------------------------------------------------------------
// Pomocné funkce
// ---------------------------------------------------------------------------

function generateSlots(timeFrom: string, timeTo: string, slotMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  let [h, m] = timeFrom.split(':').map(Number)
  const [eh, em] = timeTo.split(':').map(Number)
  const endTotal = eh * 60 + em
  while (h * 60 + m + slotMinutes <= endTotal) {
    const s = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const total2 = h * 60 + m + slotMinutes
    const e = `${String(Math.floor(total2 / 60)).padStart(2, '0')}:${String(total2 % 60).padStart(2, '0')}`
    slots.push({ start: s, end: e })
    h = Math.floor(total2 / 60)
    m = total2 % 60
  }
  return slots
}

/** Vrátí ISO string pro datum+čas v Praha timezone → UTC */
function pragueToUTC(dateStr: string, timeStr: string): string {
  const naive = new Date(`${dateStr}T${timeStr}:00`)
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    timeZoneName: 'shortOffset',
  }).formatToParts(naive).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const match = tz.match(/GMT([+-]\d+)/)
  const offsetH = parseInt(match?.[1] ?? '1', 10)
  return new Date(naive.getTime() - offsetH * 3600 * 1000).toISOString()
}

/** Převede UTC ISO na lokální čas v Praha tz */
function toLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Dnešní datum v Praha tz jako YYYY-MM-DD */
function pragueToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })
}

/** Datum +/- dny jako YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function getSlotState(
  slot: TimeSlot,
  courtId: string,
  dateStr: string,
  reservations: Reservation[],
  userId: string,
): SlotState {
  const slotStartUTC = pragueToUTC(dateStr, slot.start)
  const slotEndUTC = pragueToUTC(dateStr, slot.end)
  const slotStart = new Date(slotStartUTC)
  const slotEnd = new Date(slotEndUTC)
  const now = new Date()

  if (slotStart < now) return 'past'

  const res = reservations.find(r => {
    if (r.courtId !== courtId || r.status === 'cancelled') return false
    const rStart = new Date(r.startTime)
    const rEnd = new Date(r.endTime)
    return rStart < slotEnd && rEnd > slotStart
  })

  if (!res) return 'free'
  return res.userId === userId ? 'mine' : 'taken'
}

const SLOT_COLORS: Record<SlotState, string> = {
  free: 'bg-green-100 hover:bg-green-200 border-green-200 text-green-800 cursor-pointer',
  mine: 'bg-blue-200 hover:bg-blue-300 border-blue-400 text-blue-900 cursor-pointer',
  taken: 'bg-red-100 border-red-200 text-red-600 cursor-default',
  past: 'bg-gray-100 border-gray-200 text-gray-400 cursor-default',
}

// ---------------------------------------------------------------------------
// Komponenta
// ---------------------------------------------------------------------------

export default function ReservationGrid({
  organizationId,
  courts,
  rules,
  initialReservations,
  initialDate,
  maxAdvanceDays,
  currentUserId,
}: Props) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [dialog, setDialog] = useState<DialogData | null>(null)
  const [activeCourt, setActiveCourt] = useState(0)  // mobile: aktuální kurt
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = pragueToday()
  const maxDate = addDays(today, maxAdvanceDays)

  // -------------------------------------------------------------------
  // Načítání rezervací při změně data (client-side)
  // -------------------------------------------------------------------
  const fetchReservations = useCallback(async (d: string) => {
    const supabase = createClient()
    // Celý den: od půlnoci do půlnoci Praha timezone
    const dayStart = pragueToUTC(d, '00:00')
    const dayEnd = pragueToUTC(addDays(d, 1), '00:00')

    const { data } = await supabase
      .from('app_court_reservations')
      .select(`
        id, court_id, user_id, start_time, end_time,
        status, partner_name, note,
        user_profiles!inner ( full_name )
      `)
      .eq('organization_id', organizationId)
      .gte('start_time', dayStart)
      .lt('start_time', dayEnd)
      .neq('status', 'cancelled')

    if (data) {
      setReservations(data.map((r: any) => ({
        id: r.id,
        courtId: r.court_id,
        userId: r.user_id,
        startTime: r.start_time,
        endTime: r.end_time,
        status: r.status,
        partnerName: r.partner_name,
        note: r.note,
        userFullName: r.user_profiles?.full_name ?? null,
      })))
    }
  }, [organizationId])

  // Při změně data: načti data
  useEffect(() => {
    if (date !== initialDate) {
      fetchReservations(date)
    }
  }, [date, initialDate, fetchReservations])

  // -------------------------------------------------------------------
  // Supabase Realtime — živé aktualizace pro aktuální datum
  // -------------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`reservations-${organizationId}-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_court_reservations',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          // Při jakékoli změně znovu načteme data pro aktuální den
          fetchReservations(date)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [organizationId, date, fetchReservations])

  // -------------------------------------------------------------------
  // Navigace v datu
  // -------------------------------------------------------------------
  function goToDate(d: string) {
    if (d < today || d > maxDate) return
    setDate(d)
  }

  // -------------------------------------------------------------------
  // Klik na slot
  // -------------------------------------------------------------------
  function handleSlotClick(court: Court, slot: TimeSlot) {
    const state = getSlotState(slot, court.id, date, reservations, currentUserId)
    if (state === 'past') return

    const reservation = state !== 'free'
      ? reservations.find(r => {
          if (r.courtId !== court.id) return false
          const rStart = new Date(r.startTime)
          const rEnd = new Date(r.endTime)
          const sStart = new Date(pragueToUTC(date, slot.start))
          const sEnd = new Date(pragueToUTC(date, slot.end))
          return rStart < sEnd && rEnd > sStart && r.status !== 'cancelled'
        })
      : undefined

    setDialog({
      mode: state === 'free' ? 'create' : state === 'mine' ? 'view-mine' : 'view-taken',
      court,
      slot,
      date,
      organizationId,
      reservation: reservation
        ? {
            id: reservation.id,
            userId: reservation.userId,
            userFullName: reservation.userFullName,
            partnerName: reservation.partnerName,
            note: reservation.note,
          }
        : undefined,
    })
  }

  // -------------------------------------------------------------------
  // Ruleová data pro vybraný den
  // -------------------------------------------------------------------
  function getRuleForCourt(courtId: string): CourtRule | undefined {
    return rules.find(r => r.courtId === courtId)
  }

  // Sjednocená časová osa: union všech slotů všech kurtů
  const allSlots = courts.reduce<TimeSlot[]>((acc, court) => {
    const rule = getRuleForCourt(court.id)
    if (!rule) return acc
    const slots = generateSlots(rule.timeFrom, rule.timeTo, rule.slotMinutes)
    for (const s of slots) {
      if (!acc.some(a => a.start === s.start)) acc.push(s)
    }
    return acc
  }, []).sort((a, b) => a.start.localeCompare(b.start))

  // -------------------------------------------------------------------
  // Mobilní navigace kurtů (scroll-snap)
  // -------------------------------------------------------------------
  function scrollToCourt(idx: number) {
    setActiveCourt(idx)
    if (scrollRef.current) {
      const child = scrollRef.current.children[idx] as HTMLElement
      child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    }
  }

  // -------------------------------------------------------------------
  // Datum label
  // -------------------------------------------------------------------
  const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Prague',
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Navigace data */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goToDate(addDays(date, -1))}
          disabled={date <= today}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Předchozí den"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900 capitalize">{dateLabel}</p>
          {date === today && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Dnes</span>
          )}
        </div>

        <button
          onClick={() => goToDate(addDays(date, 1))}
          disabled={date >= maxDate}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Následující den"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobilní: přepínač kurtů */}
      <div className="flex gap-2 sm:hidden">
        {courts.map((court, idx) => (
          <button
            key={court.id}
            onClick={() => scrollToCourt(idx)}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
              activeCourt === idx
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {court.name}
          </button>
        ))}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-green-200 border border-green-300" />
          Volno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-blue-200 border border-blue-400" />
          Moje rezervace
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-100 border border-red-200" />
          Obsazeno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-gray-100 border border-gray-200" />
          Minulost
        </span>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        {/* Záhlaví sloupců (desktop) */}
        <div className="hidden sm:grid border-b bg-gray-50" style={{ gridTemplateColumns: `5rem repeat(${courts.length}, 1fr)` }}>
          <div className="py-3 px-2" />
          {courts.map(court => (
            <div key={court.id} className="py-3 px-2 text-center text-sm font-semibold text-gray-700 border-l border-gray-200">
              {court.name}
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({court.surface === 'clay' ? 'antuka' : court.surface === 'hard' ? 'tvrdý' : 'tráva'})
              </span>
            </div>
          ))}
        </div>

        {/* Mobilní: horizontální scroll s snap */}
        <div
          ref={scrollRef}
          className="sm:hidden flex overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
          onScroll={(e) => {
            const el = e.currentTarget
            const idx = Math.round(el.scrollLeft / el.clientWidth)
            setActiveCourt(idx)
          }}
        >
          {courts.map(court => {
            const rule = getRuleForCourt(court.id)
            const slots = rule ? generateSlots(rule.timeFrom, rule.timeTo, rule.slotMinutes) : []
            return (
              <div key={court.id} className="min-w-full snap-start flex-shrink-0">
                <div className="sticky top-0 z-10 border-b bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-700">{court.name}</p>
                </div>
                {slots.length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-400">Žádná dostupná okna.</p>
                )}
                {slots.map(slot => {
                  const state = getSlotState(slot, court.id, date, reservations, currentUserId)
                  const res = state !== 'free' && state !== 'past'
                    ? reservations.find(r => {
                        if (r.courtId !== court.id) return false
                        const rStart = new Date(r.startTime)
                        const rEnd = new Date(r.endTime)
                        const sStart = new Date(pragueToUTC(date, slot.start))
                        const sEnd = new Date(pragueToUTC(date, slot.end))
                        return rStart < sEnd && rEnd > sStart
                      })
                    : undefined
                  return (
                    <div
                      key={slot.start}
                      onClick={() => handleSlotClick(court, slot)}
                      className={`flex items-center border-b border-gray-100 px-4 py-3 ${SLOT_COLORS[state]}`}
                    >
                      <span className="w-16 text-sm font-mono font-medium">{slot.start}</span>
                      <span className="flex-1 text-sm">
                        {state === 'mine' && 'Vaše rezervace'}
                        {state === 'taken' && (res?.userFullName ?? 'Obsazeno')}
                        {state === 'free' && 'Volno'}
                        {state === 'past' && ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Desktop: kompaktní grid */}
        <div className="hidden sm:block overflow-x-auto">
          {allSlots.map(slot => (
            <div
              key={slot.start}
              className="grid border-b border-gray-100"
              style={{ gridTemplateColumns: `5rem repeat(${courts.length}, 1fr)` }}
            >
              {/* Čas */}
              <div className="py-2 px-2 text-xs font-mono text-gray-400 flex items-center">
                {slot.start}
              </div>
              {/* Kurty */}
              {courts.map(court => {
                const rule = getRuleForCourt(court.id)
                // Kurt tento slot nenabízí (není v jeho pravidlech)
                const courtSlots = rule ? generateSlots(rule.timeFrom, rule.timeTo, rule.slotMinutes) : []
                const hasSlot = courtSlots.some(s => s.start === slot.start)
                if (!hasSlot) {
                  return (
                    <div key={court.id} className="border-l border-gray-100 bg-gray-50 py-2 px-2" />
                  )
                }
                const state = getSlotState(slot, court.id, date, reservations, currentUserId)
                const res = state !== 'free' && state !== 'past'
                  ? reservations.find(r => {
                      if (r.courtId !== court.id) return false
                      const rStart = new Date(r.startTime)
                      const rEnd = new Date(r.endTime)
                      const sStart = new Date(pragueToUTC(date, slot.start))
                      const sEnd = new Date(pragueToUTC(date, slot.end))
                      return rStart < sEnd && rEnd > sStart
                    })
                  : undefined
                return (
                  <div
                    key={court.id}
                    onClick={() => state !== 'past' && handleSlotClick(court, slot)}
                    className={`border-l border-gray-100 py-2 px-2 min-h-[2.5rem] text-xs ${SLOT_COLORS[state]}`}
                    title={
                      state === 'taken' ? (res?.userFullName ?? 'Obsazeno') :
                      state === 'mine' ? 'Vaše rezervace' :
                      state === 'free' ? 'Kliknout pro rezervaci' : ''
                    }
                  >
                    {state === 'taken' && (
                      <span className="truncate block">{res?.userFullName ?? 'Obsazeno'}</span>
                    )}
                    {state === 'mine' && (
                      <span className="font-medium">✓ Moje</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Dialog */}
      {dialog && (
        <ReservationDialog
          data={dialog}
          onClose={() => setDialog(null)}
          onSuccess={() => fetchReservations(date)}
        />
      )}
    </div>
  )
}
