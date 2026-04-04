'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReservationDialog, { type DialogData, type OrgMember } from './ReservationDialog'

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
  timeFrom: string
  timeTo: string
  slotMinutes: number
  priceMember: number
  priceGuest: number
  maxAdvanceDays: number
  maxDurationMinutes: number
  minGapMinutes: number
  maxPerWeek: number | null
  requirePartner: boolean
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
  orgMembers: OrgMember[]
  view: 'day' | 'week'
  weekStart: string
  userReservationDates: Array<{ dateStr: string; active: boolean }>
}

type TimeSlot = { start: string; end: string }
type SlotState = 'free' | 'mine' | 'taken' | 'past'

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minToTime(t: number) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }

function gen30Slots(from: string, to: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  let t = timeToMin(from)
  const end = timeToMin(to)
  while (t + 30 <= end) { slots.push({ start: minToTime(t), end: minToTime(t + 30) }); t += 30 }
  return slots
}

/** UTC konverze — identická s verzí v ReservationDialog.tsx */
function toUTC(dateStr: string, timeStr: string): string {
  const probe = new Date(`${dateStr}T${timeStr}:00Z`)
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague', timeZoneName: 'shortOffset',
  }).formatToParts(probe).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2'
  const off = parseInt(tz.match(/GMT([+-]\d+)/)?.[1] ?? '2', 10)
  return new Date(probe.getTime() - off * 3_600_000).toISOString()
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

/** Pondělí týdne obsahujícího dané datum (UTC-safe) */
function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const dow = d.getUTCDay()
  const daysFromMon = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - daysFromMon)
  return d.toISOString().split('T')[0]
}

/** UTC ISO → pražské YYYY-MM-DD */
function getLocalDate(utcIso: string): string {
  return new Date(utcIso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })
}

function getSlotState(
  slot: TimeSlot, courtId: string, dateStr: string,
  reservations: Reservation[], userId: string,
): SlotState {
  const s = new Date(toUTC(dateStr, slot.start))
  const e = new Date(toUTC(dateStr, slot.end))
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
  const s = new Date(toUTC(dateStr, slot.start))
  const e = new Date(toUTC(dateStr, slot.end))
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
// Sdílená legenda
// ---------------------------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
      {[
        ['bg-green-200 border-green-300', 'Volno – kliknutím rezervovat'],
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
  )
}

// ---------------------------------------------------------------------------
// Kalendářní widget
// ---------------------------------------------------------------------------

const CZ_MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec']
const CZ_DAYS = ['Po','Út','St','Čt','Pá','So','Ne']

function CalendarPicker({ currentDate, today, maxDate, onSelect, onClose, activeDates, pastDates }: {
  currentDate: string; today: string; maxDate: string
  onSelect: (d: string) => void; onClose: () => void
  activeDates: Set<string>; pastDates: Set<string>
}) {
  const [vm, setVm] = useState(() => {
    const d = new Date(currentDate + 'T12:00:00Z')
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
  })

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(vm.year, vm.month, 1))
    const last  = new Date(Date.UTC(vm.year, vm.month + 1, 0))
    const startDow = (first.getUTCDay() + 6) % 7  // 0=Mon
    const arr: (string | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= last.getUTCDate(); d++) {
      arr.push(`${vm.year}-${String(vm.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    // Fill to complete weeks
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [vm])

  function changeMonth(delta: number) {
    setVm(v => {
      let m = v.month + delta
      let y = v.year
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  return (
    <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-72">
      {/* Navigace měsíce */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeMonth(-1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 text-lg leading-none">‹</button>
        <span className="text-sm font-semibold text-gray-800">{CZ_MONTHS[vm.month]} {vm.year}</span>
        <button onClick={() => changeMonth(1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 text-lg leading-none">›</button>
      </div>
      {/* Hlavička dnů */}
      <div className="grid grid-cols-7 mb-1">
        {CZ_DAYS.map(d => (
          <span key={d} className="text-center text-[11px] font-medium text-gray-400">{d}</span>
        ))}
      </div>
      {/* Buňky */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((ds, i) => {
          if (!ds) return <span key={i} />
          const isToday    = ds === today
          const isCurrent  = ds === currentDate
          const disabled   = ds < today || ds > maxDate
          return (
            <button
              key={ds}
              disabled={disabled}
              onClick={() => { onSelect(ds); onClose() }}
              className={`h-8 w-full relative rounded-lg text-xs font-medium transition-colors ${
                isCurrent ? 'bg-green-600 text-white' :
                isToday   ? 'bg-green-100 text-green-700 ring-1 ring-green-300' :
                disabled  ? 'text-gray-300 cursor-default' :
                'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {new Date(ds + 'T12:00:00Z').getUTCDate()}
              {activeDates.has(ds) && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${isCurrent ? 'bg-white' : 'bg-green-500'}`} />
              )}
              {!activeDates.has(ds) && pastDates.has(ds) && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-gray-400" />
              )}
            </button>
          )
        })}
      </div>
      <button
        onClick={onClose}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 text-center"
      >
        Zavřít
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hlavní komponenta
// ---------------------------------------------------------------------------

export default function ReservationGrid({
  organizationId, courts, rules, initialReservations, initialDate,
  maxAdvanceDays, currentUserId, orgMembers, view, weekStart: initialWeekStart,
  userReservationDates,
}: Props) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [dialog, setDialog] = useState<DialogData | null>(null)
  const [activeCourt, setActiveCourt] = useState(0)
  const [activeCourtWeek, setActiveCourtWeek] = useState(0)
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentView, setCurrentView] = useState<'day' | 'week'>(view)
  const [currentWeekStart, setCurrentWeekStart] = useState(initialWeekStart)
  const calRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = pragueToday()
  const maxDate = addDays(today, maxAdvanceDays)

  // Sady dat pro zvýraznění v kalendáři
  const activeDates = useMemo(
    () => new Set(userReservationDates.filter(r => r.active).map(r => r.dateStr)),
    [userReservationDates]
  )
  const pastDates = useMemo(
    () => new Set(userReservationDates.filter(r => !r.active).map(r => r.dateStr)),
    [userReservationDates]
  )

  // Sync s initial props (po router.refresh)
  useEffect(() => { setDate(initialDate) }, [initialDate])
  useEffect(() => { setReservations(initialReservations) }, [initialReservations])
  useEffect(() => { setCurrentView(view) }, [view])
  useEffect(() => { setCurrentWeekStart(initialWeekStart) }, [initialWeekStart])

  // Zavřít kalendář při kliknutí mimo
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCalendar(false)
    }
    if (showCalendar) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showCalendar])

  // Realtime — při změně v DB refreshne server komponent
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

  function goToDate(d: string) {
    if (d < today || d > maxDate) return
    setDate(d)
    router.push(`/rezervace?datum=${d}&view=${currentView}`)
  }

  function goToWeek(ws: string) {
    setCurrentWeekStart(ws)
    router.push(`/rezervace?datum=${ws}&view=week`)
  }

  function switchView(v: 'day' | 'week') {
    setCurrentView(v)
    if (v === 'week') {
      const ws = getWeekStart(date)
      router.push(`/rezervace?datum=${ws}&view=week`)
    } else {
      router.push(`/rezervace?datum=${date}&view=day`)
    }
  }

  function getRule(courtId: string) {
    return rules.find(r => r.courtId === courtId)
  }

  /** Obsazené intervaly pro daný kurt a den (předávané do dialogu) */
  function getBusyForDay(courtId: string, dayStr: string) {
    return reservations
      .filter(r => r.courtId === courtId && r.status !== 'cancelled' && getLocalDate(r.startTime) === dayStr)
      .map(r => ({
        start: utcToHHMM(r.startTime),
        end: utcToHHMM(r.endTime),
        userName: r.userFullName,
        isOwn: r.userId === currentUserId,
      }))
  }

  function getBusy(courtId: string) {
    return getBusyForDay(courtId, date)
  }

  /** Jednotný handler otevření dialogu — funguje pro denní i týdenní pohled */
  function openDialog(court: Court, slot: TimeSlot, dayStr: string) {
    const state = getSlotState(slot, court.id, dayStr, reservations, currentUserId)
    if (state === 'past') return
    const rule = getRule(court.id)

    if (state === 'free') {
      setDialog({
        mode: 'create',
        court, date: dayStr, organizationId,
        startTime: slot.start,
        courtTimeFrom: rule?.timeFrom ?? '07:00',
        courtTimeTo: rule?.timeTo ?? '21:00',
        maxDurationMinutes: rule?.maxDurationMinutes ?? 120,
        requirePartner: rule?.requirePartner ?? false,
        busyIntervals: getBusyForDay(court.id, dayStr),
        orgMembers,
      })
    } else {
      const res = getResAtSlot(slot, court.id, dayStr, reservations)
      if (!res) return
      setDialog({
        mode: res.userId === currentUserId ? 'view-mine' : 'view-taken',
        court, date: dayStr, organizationId,
        startTime: utcToHHMM(res.startTime),
        endTime: utcToHHMM(res.endTime),
        courtTimeFrom: rule?.timeFrom ?? '07:00',
        courtTimeTo: rule?.timeTo ?? '21:00',
        maxDurationMinutes: rule?.maxDurationMinutes ?? 120,
        requirePartner: rule?.requirePartner ?? false,
        busyIntervals: [],
        orgMembers,
        reservation: {
          id: res.id, userId: res.userId,
          userFullName: res.userFullName,
          partnerName: res.partnerName,
          note: res.note,
        },
      })
    }
  }

  function handleSlotClick(court: Court, slot: TimeSlot) {
    openDialog(court, slot, date)
  }

  // Sjednocená 30-min osa (union přes všechny kurty)
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

  // Týdenní pohled — výpočty
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  )

  const weekCourtIdx = Math.min(activeCourtWeek, courts.length - 1)
  const weekCourt = courts[weekCourtIdx]
  const weekRule = weekCourt ? getRule(weekCourt.id) : undefined
  const weekSlots = weekRule ? gen30Slots(weekRule.timeFrom, weekRule.timeTo) : []

  const weekLabel = weekDays.length === 7
    ? (() => {
        const d0 = new Date(weekDays[0] + 'T12:00:00Z')
        const d6 = new Date(weekDays[6] + 'T12:00:00Z')
        const sameMonth = d0.getUTCMonth() === d6.getUTCMonth()
        return sameMonth
          ? `${d0.getUTCDate()}.–${d6.getUTCDate()}. ${CZ_MONTHS[d6.getUTCMonth()]} ${d6.getUTCFullYear()}`
          : `${d0.getUTCDate()}. ${CZ_MONTHS[d0.getUTCMonth()]} – ${d6.getUTCDate()}. ${CZ_MONTHS[d6.getUTCMonth()]} ${d6.getUTCFullYear()}`
      })()
    : ''

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">

      {/* Přepínač Den / Týden */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 self-start">
        <button
          onClick={() => switchView('day')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            currentView === 'day' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Den
        </button>
        <button
          onClick={() => switchView('week')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            currentView === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Týden
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ DENNÍ POHLED */}
      {currentView === 'day' && (<>

      {/* Navigace data + kalendář */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => goToDate(addDays(date, -1))}
          disabled={date <= today}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          aria-label="Předchozí den"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Klikatelné datum → otevře kalendář */}
        <div className="relative" ref={calRef}>
          <button
            onClick={() => setShowCalendar(v => !v)}
            className="flex flex-col items-center group"
          >
            <p className="text-sm font-semibold text-gray-900 capitalize group-hover:text-green-700 transition-colors">
              {dateLabel}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {date === today && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Dnes</span>
              )}
              <span className="text-xs text-gray-400 group-hover:text-green-600">📅 kalend.</span>
            </div>
          </button>
          {showCalendar && (
            <CalendarPicker
              currentDate={date}
              today={today}
              maxDate={maxDate}
              onSelect={goToDate}
              onClose={() => setShowCalendar(false)}
              activeDates={activeDates}
              pastDates={pastDates}
            />
          )}
        </div>

        <button
          onClick={() => goToDate(addDays(date, 1))}
          disabled={date >= maxDate}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
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

      <Legend />

      {/* ─── Grid ─── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">

        {/* Desktop: záhlaví kurtů */}
        <div
          className="hidden sm:grid border-b bg-gray-50"
          style={{ gridTemplateColumns: `4.5rem repeat(${courts.length}, 1fr)` }}
        >
          <div className="py-3" />
          {courts.map(c => (
            <div key={c.id} className="py-3 px-2 text-center text-sm font-semibold text-gray-700 border-l border-green-300">
              {c.name}
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({c.surface === 'clay' ? 'antuka' : c.surface === 'hard' ? 'tvrdý' : c.surface})
              </span>
            </div>
          ))}
        </div>

        {/* Mobilní: scroll + snap */}
        <div
          ref={scrollRef}
          className="sm:hidden flex overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
          onScroll={e => setActiveCourt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {courts.map(court => {
            const rule = getRule(court.id)
            const slots = rule ? gen30Slots(rule.timeFrom, rule.timeTo) : []
            return (
              <div key={court.id} className="min-w-full snap-start flex-shrink-0">
                <div className="sticky top-0 z-10 border-b bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700">{court.name}</div>
                {slots.map(slot => {
                  const isHour = slot.start.endsWith(':00')
                  const state = getSlotState(slot, court.id, date, reservations, currentUserId)
                  const res = getResAtSlot(slot, court.id, date, reservations)
                  const isFirstSlot = res ? utcToHHMM(res.startTime) === slot.start : false
                  return (
                    <div
                      key={slot.start}
                      onClick={() => handleSlotClick(court, slot)}
                      className={`flex items-center px-4 h-[1.875rem] ${
                        isHour ? 'border-t border-gray-300' : 'border-t border-dashed border-gray-200'
                      } ${COLORS[state]}`}
                    >
                      <span className={`w-14 font-mono shrink-0 ${isHour ? 'text-sm font-semibold text-gray-700' : 'text-xs text-gray-200'}`}>
                        {isHour ? slot.start : ''}
                      </span>
                      <span className="flex-1 text-xs pl-1">
                        {isFirstSlot && state === 'taken' && <span className="text-red-700">{res?.userFullName ?? 'Obsazeno'}</span>}
                        {isFirstSlot && state === 'mine' && <span className="text-blue-700 font-medium">✓ Vaše rezervace {utcToHHMM(res!.startTime)}–{utcToHHMM(res!.endTime)}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Desktop: grid */}
        <div className="hidden sm:block">
          {allSlots.map(slot => {
            const isHour = slot.start.endsWith(':00')
            return (
              <div
                key={slot.start}
                className={`grid ${isHour ? 'border-t border-gray-300' : 'border-t border-dashed border-gray-100'}`}
                style={{ gridTemplateColumns: `4.5rem repeat(${courts.length}, 1fr)` }}
              >
                {/* Čas */}
                <div className="flex items-center justify-end pr-3 h-[1.875rem]">
                  {isHour
                    ? <span className="text-xs font-semibold text-gray-600 tabular-nums">{slot.start}</span>
                    : <span className="text-[10px] text-gray-200">·</span>}
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
                        className="border-l border-green-100 bg-gray-50 h-[1.875rem]"
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
                      className={`border-l border-green-200 px-2 flex items-center h-[1.875rem] ${COLORS[state]}`}
                      title={
                        state === 'free' ? `Kliknutím vybrat čas od ${slot.start}` :
                        state === 'mine' && res ? `Vaše rezervace ${utcToHHMM(res.startTime)}–${utcToHHMM(res.endTime)}` :
                        state === 'taken' ? (res?.userFullName ?? 'Obsazeno') : ''
                      }
                    >
                      {isFirstSlot && state === 'taken' && (
                        <span className="text-[11px] text-red-700 truncate leading-tight">{res?.userFullName ?? 'Obsazeno'}</span>
                      )}
                      {isFirstSlot && state === 'mine' && (
                        <span className="text-[11px] text-blue-700 font-semibold truncate">
                          ✓ {utcToHHMM(res!.startTime)}–{utcToHHMM(res!.endTime)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      </>)}

      {/* ═══════════════════════════════════════════════════════ TÝDENNÍ POHLED */}
      {currentView === 'week' && (<>

        {/* Navigace týdnů */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => goToWeek(addDays(currentWeekStart, -7))}
            disabled={addDays(currentWeekStart, -1) < today}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Předchozí
          </button>
          <span className="text-sm font-semibold text-gray-800 text-center">{weekLabel}</span>
          <button
            onClick={() => goToWeek(addDays(currentWeekStart, 7))}
            disabled={addDays(currentWeekStart, 7) > maxDate}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Další
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Přepínač kurtů */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {courts.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setActiveCourtWeek(idx)}
              className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                weekCourtIdx === idx
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {c.name}
              <span className={`ml-1.5 text-xs font-normal ${weekCourtIdx === idx ? 'text-green-100' : 'text-gray-400'}`}>
                ({c.surface === 'clay' ? 'antuka' : c.surface === 'hard' ? 'tvrdý' : c.surface})
              </span>
            </button>
          ))}
        </div>

        <Legend />

        {/* Týdenní grid — horizontální scroll na mobilech */}
        {weekCourt && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            {/* Záhlaví dnů */}
            <div
              className="grid border-b bg-gray-50"
              style={{ gridTemplateColumns: '4.5rem repeat(7, minmax(80px, 1fr))', minWidth: '680px' }}
            >
              <div className="py-3" />
              {weekDays.map((dayStr, dayIdx) => {
                const d = new Date(dayStr + 'T12:00:00Z')
                const isToday = dayStr === today
                return (
                  <div
                    key={dayStr}
                    className={`py-2 px-1 text-center border-l border-green-300 ${isToday ? 'bg-green-50' : ''}`}
                  >
                    <div className="text-xs font-semibold text-gray-600">{CZ_DAYS[dayIdx]}</div>
                    <div className={`text-xs tabular-nums ${isToday ? 'text-green-700 font-bold' : 'text-gray-500'}`}>
                      {d.getUTCDate()}.{d.getUTCMonth() + 1}.
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Řádky slotů */}
            {weekSlots.map(slot => {
              const isHour = slot.start.endsWith(':00')
              return (
                <div
                  key={slot.start}
                  className={`grid ${isHour ? 'border-t border-gray-300' : 'border-t border-dashed border-gray-100'}`}
                  style={{ gridTemplateColumns: '4.5rem repeat(7, minmax(80px, 1fr))', minWidth: '680px' }}
                >
                  {/* Čas */}
                  <div className="flex items-center justify-end pr-3 h-[1.875rem]">
                    {isHour
                      ? <span className="text-xs font-semibold text-gray-600 tabular-nums">{slot.start}</span>
                      : <span className="text-[10px] text-gray-200">·</span>
                    }
                  </div>

                  {/* Buňky dnů */}
                  {weekDays.map(dayStr => {
                    const state = getSlotState(slot, weekCourt.id, dayStr, reservations, currentUserId)
                    const res = getResAtSlot(slot, weekCourt.id, dayStr, reservations)
                    const isFirstSlot = res ? utcToHHMM(res.startTime) === slot.start : false
                    const isToday = dayStr === today
                    return (
                      <div
                        key={dayStr}
                        onClick={() => state !== 'past' && openDialog(weekCourt, slot, dayStr)}
                        className={`border-l border-green-200 px-1 flex items-center h-[1.875rem] ${
                          isToday && state === 'free' ? 'bg-green-50/50' : ''
                        } ${COLORS[state]}`}
                        title={
                          state === 'taken' ? (res?.userFullName ?? 'Obsazeno') :
                          state === 'mine' ? `Vaše: ${utcToHHMM(res!.startTime)}–${utcToHHMM(res!.endTime)}` :
                          state === 'free' ? `Rezervovat od ${slot.start}` : ''
                        }
                      >
                        {isFirstSlot && state === 'taken' && (
                          <span className="text-[10px] text-red-700 truncate leading-tight">{res?.userFullName ?? '•'}</span>
                        )}
                        {isFirstSlot && state === 'mine' && (
                          <span className="text-[10px] text-blue-700 font-semibold leading-tight truncate">
                            ✓ {utcToHHMM(res!.startTime)}–{utcToHHMM(res!.endTime)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </>)}

      {/* Dialog — sdílený pro oba pohledy */}
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
