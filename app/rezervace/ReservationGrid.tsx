'use client'

import { useEffect, useRef, useState } from 'react'
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
  initialDate: string
  maxAdvanceDays: number
  currentUserId: string
}

type TimeSlot = { start: string; end: string }
type SlotState = 'free' | 'mine' | 'taken' | 'past'

// ---------------------------------------------------------------------------
// Pomocné funkce
// ---------------------------------------------------------------------------

/** Generuje 30-minutové sloty pro vizuální grid (bez ohledu na slotMinutes pravidla) */
function gen30Slots(from: string, to: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  let [h, m] = from.split(':').map(Number)
  const [eh, em] = to.split(':').map(Number)
  const end = eh * 60 + em
  while (h * 60 + m + 30 <= end) {
    const s = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const t = h * 60 + m + 30
    const e = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    slots.push({ start: s, end: e })
    h = Math.floor(t / 60); m = t % 60
  }
  return slots
}

function pragueToUTC(dateStr: string, timeStr: string): string {
  const naive = new Date(`${dateStr}T${timeStr}:00`)
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague', timeZoneName: 'shortOffset',
  }).formatToParts(naive).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const offsetH = parseInt(tz.match(/GMT([+-]\d+)/)?.[1] ?? '1', 10)
  return new Date(naive.getTime() - offsetH * 3_600_000).toISOString()
}

function utcToHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', {
    timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false,
  }).substring(0, 5)
}

function pragueToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })
}

function addDays(d: string, n: number): string {
  const date = new Date(`${d}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().split('T')[0]
}

function getSlotState(
  slot: TimeSlot, courtId: string, dateStr: string,
  reservations: Reservation[], userId: string,
): SlotState {
  const s = new Date(pragueToUTC(dateStr, slot.start))
  const e = new Date(pragueToUTC(dateStr, slot.end))
  if (s < new Date()) return 'past'
  const res = reservations.find(r =>
    r.courtId === courtId && r.status !== 'cancelled' &&
    new Date(r.startTime) < e && new Date(r.endTime) > s
  )
  if (!res) return 'free'
  return res.userId === userId ? 'mine' : 'taken'
}

function getResAtSlot(
  slot: TimeSlot, courtId: string, dateStr: string, reservations: Reservation[],
): Reservation | null {
  const s = new Date(pragueToUTC(dateStr, slot.start))
  const e = new Date(pragueToUTC(dateStr, slot.end))
  return reservations.find(r =>
    r.courtId === courtId && r.status !== 'cancelled' &&
    new Date(r.startTime) < e && new Date(r.endTime) > s
  ) ?? null
}

const COLORS: Record<SlotState, string> = {
  free:  'bg-green-50 hover:bg-green-100 cursor-pointer',
  mine:  'bg-blue-100 hover:bg-blue-200 cursor-pointer',
  taken: 'bg-red-50 cursor-default',
  past:  'bg-gray-50 cursor-default',
}

// ---------------------------------------------------------------------------
// Komponenta
// ---------------------------------------------------------------------------

export default function ReservationGrid({
  organizationId, courts, rules, initialReservations, initialDate, maxAdvanceDays, currentUserId,
}: Props) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [dialog, setDialog] = useState<DialogData | null>(null)
  const [activeCourt, setActiveCourt] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = pragueToday()
  const maxDate = addDays(today, maxAdvanceDays)

  // Sync: server komponent se přerenderoval (router.refresh / router.push) → aktualizuj stav
  useEffect(() => { setDate(initialDate) }, [initialDate])
  useEffect(() => { setReservations(initialReservations) }, [initialReservations])

  // Realtime — při změně v DB jen refreshne server komponent
  // Data se vrátí přes initialReservations prop (server queries přes adminClient, bez RLS problémů)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`res-${organizationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'app_court_reservations',
        filter: `organization_id=eq.${organizationId}`,
      }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [organizationId, router])

  // Navigace data přes URL → server re-renderuje s novými daty z adminClient
  function goToDate(d: string) {
    if (d < today || d > maxDate) return
    setDate(d) // optimistická aktualizace
    router.push(`/rezervace?datum=${d}`)
  }

  function getRule(courtId: string) {
    return rules.find(r => r.courtId === courtId)
  }

  /** Obsazené intervaly pro kurt v lokálním HH:MM (pro výběr konce rezervace v dialogu) */
  function getBusy(courtId: string) {
    return reservations
      .filter(r => r.courtId === courtId && r.status !== 'cancelled')
      .map(r => ({ start: utcToHHMM(r.startTime), end: utcToHHMM(r.endTime) }))
  }

  function handleSlotClick(court: Court, slot: TimeSlot) {
    const state = getSlotState(slot, court.id, date, reservations, currentUserId)
    if (state === 'past') return
    const rule = getRule(court.id)

    if (state === 'free') {
      setDialog({
        mode: 'create',
        court, date, organizationId,
        startTime: slot.start,
        courtTimeTo: rule?.timeTo ?? '21:00',
        busyIntervals: getBusy(court.id),
      })
    } else {
      const res = getResAtSlot(slot, court.id, date, reservations)
      if (!res) return
      setDialog({
        mode: res.userId === currentUserId ? 'view-mine' : 'view-taken',
        court, date, organizationId,
        startTime: utcToHHMM(res.startTime),
        endTime: utcToHHMM(res.endTime),
        courtTimeTo: rule?.timeTo ?? '21:00',
        busyIntervals: [],
        reservation: {
          id: res.id, userId: res.userId,
          userFullName: res.userFullName,
          partnerName: res.partnerName,
          note: res.note,
        },
      })
    }
  }

  // Sjednocená 30-min osa pro desktop grid (union přes všechny kurty)
  const allSlots = courts.reduce<TimeSlot[]>((acc, c) => {
    const rule = getRule(c.id)
    if (!rule) return acc
    for (const s of gen30Slots(rule.timeFrom, rule.timeTo)) {
      if (!acc.some(a => a.start === s.start)) acc.push(s)
    }
    return acc
  }, []).sort((a, b) => a.start.localeCompare(b.start))

  function scrollToCourt(idx: number) {
    setActiveCourt(idx)
    const child = scrollRef.current?.children[idx] as HTMLElement
    child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  const dateLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Prague',
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

      {/* Mobilní přepínač kurtů */}
      <div className="flex gap-2 sm:hidden">
        {courts.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => scrollToCourt(idx)}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
              activeCourt === idx
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {[
          ['bg-green-200 border-green-300', 'Volno – kliknutím vybrat čas'],
          ['bg-blue-200 border-blue-400', 'Moje rezervace'],
          ['bg-red-100 border-red-200', 'Obsazeno'],
          ['bg-gray-100 border-gray-200', 'Minulost'],
        ].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded border ${cls}`} />
            {label}
          </span>
        ))}
      </div>

      {/* --------------- Grid --------------- */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">

        {/* Desktop: záhlaví sloupců */}
        <div
          className="hidden sm:grid border-b bg-gray-50"
          style={{ gridTemplateColumns: `4.5rem repeat(${courts.length}, 1fr)` }}
        >
          <div className="py-3 px-2" />
          {courts.map(c => (
            <div key={c.id} className="py-3 px-2 text-center text-sm font-semibold text-gray-700 border-l border-gray-200">
              {c.name}
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({c.surface === 'clay' ? 'antuka' : c.surface === 'hard' ? 'tvrdý' : c.surface})
              </span>
            </div>
          ))}
        </div>

        {/* Mobilní: horizontální scroll + snap */}
        <div
          ref={scrollRef}
          className="sm:hidden flex overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
          onScroll={e => {
            const idx = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth)
            setActiveCourt(idx)
          }}
        >
          {courts.map(court => {
            const rule = getRule(court.id)
            const slots = rule ? gen30Slots(rule.timeFrom, rule.timeTo) : []
            return (
              <div key={court.id} className="min-w-full snap-start flex-shrink-0">
                <div className="sticky top-0 z-10 border-b bg-gray-50 px-4 py-2.5">
                  <p className="text-sm font-semibold text-gray-700">{court.name}</p>
                </div>
                {slots.map(slot => {
                  const isHour = slot.start.endsWith(':00')
                  const state = getSlotState(slot, court.id, date, reservations, currentUserId)
                  const res = getResAtSlot(slot, court.id, date, reservations)
                  const isFirstSlot = res ? utcToHHMM(res.startTime) === slot.start : false
                  return (
                    <div
                      key={slot.start}
                      onClick={() => handleSlotClick(court, slot)}
                      className={`flex items-center px-4 ${
                        isHour
                          ? 'border-t border-gray-300 min-h-[2.25rem]'
                          : 'border-t border-dashed border-gray-200 min-h-[1.5rem]'
                      } ${COLORS[state]}`}
                    >
                      <span className={`w-14 font-mono shrink-0 ${
                        isHour ? 'text-sm font-semibold text-gray-700' : 'text-xs text-gray-300'
                      }`}>
                        {isHour ? slot.start : ''}
                      </span>
                      <span className="flex-1 text-sm pl-1">
                        {isFirstSlot && state === 'taken' && (
                          <span className="text-red-700 text-xs">{res?.userFullName ?? 'Obsazeno'}</span>
                        )}
                        {isFirstSlot && state === 'mine' && (
                          <span className="text-blue-700 text-xs font-medium">✓ Vaše rezervace</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Desktop: grid - hodiny = silná čára + popisek, půlhodiny = čárkovaná */}
        <div className="hidden sm:block">
          {allSlots.map(slot => {
            const isHour = slot.start.endsWith(':00')
            return (
              <div
                key={slot.start}
                className={`grid ${
                  isHour ? 'border-t border-gray-300' : 'border-t border-dashed border-gray-100'
                }`}
                style={{ gridTemplateColumns: `4.5rem repeat(${courts.length}, 1fr)` }}
              >
                {/* Časové popisky – pouze celé hodiny */}
                <div className={`flex items-center justify-end pr-3 ${isHour ? 'py-2' : 'py-0.5'}`}>
                  {isHour ? (
                    <span className="text-xs font-semibold text-gray-600 tabular-nums">{slot.start}</span>
                  ) : (
                    <span className="text-[10px] text-gray-300">·</span>
                  )}
                </div>

                {/* Buňky kurtů */}
                {courts.map(court => {
                  const rule = getRule(court.id)
                  const hasSlot = rule
                    ? gen30Slots(rule.timeFrom, rule.timeTo).some(s => s.start === slot.start)
                    : false

                  if (!hasSlot) {
                    return (
                      <div
                        key={court.id}
                        className={`border-l border-gray-100 bg-gray-50 ${isHour ? 'min-h-[2rem]' : 'min-h-[1.25rem]'}`}
                      />
                    )
                  }

                  const state = getSlotState(slot, court.id, date, reservations, currentUserId)
                  const res = getResAtSlot(slot, court.id, date, reservations)
                  const isFirstSlot = res ? utcToHHMM(res.startTime) === slot.start : false

                  return (
                    <div
                      key={court.id}
                      onClick={() => state !== 'past' && handleSlotClick(court, slot)}
                      className={`border-l border-gray-100 px-2 flex items-center ${
                        isHour ? 'min-h-[2rem]' : 'min-h-[1.25rem]'
                      } ${COLORS[state]}`}
                      title={
                        state === 'free' ? `Kliknutím vybrat čas od ${slot.start}` :
                        state === 'mine' && res ? `Vaše rezervace ${utcToHHMM(res.startTime)}–${utcToHHMM(res.endTime)}` :
                        state === 'taken' ? (res?.userFullName ?? 'Obsazeno') : ''
                      }
                    >
                      {isFirstSlot && state === 'taken' && (
                        <span className="text-[11px] text-red-700 truncate leading-tight">
                          {res?.userFullName ?? 'Obsazeno'}
                        </span>
                      )}
                      {isFirstSlot && state === 'mine' && (
                        <span className="text-[11px] text-blue-700 font-semibold">✓ Moje</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Dialog */}
      {dialog && (
        <ReservationDialog
          data={dialog}
          onClose={() => setDialog(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}
