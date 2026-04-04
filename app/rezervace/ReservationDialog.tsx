'use client'

import { useState, useEffect, useTransition, useMemo, useRef } from 'react'
import { createReservation, cancelReservation } from './actions'

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

export type OrgMember = { id: string; fullName: string }

export type DialogMode = 'create' | 'view-mine' | 'view-taken'

export type DialogData = {
  mode: DialogMode
  court: { id: string; name: string }
  date: string            // YYYY-MM-DD
  organizationId: string
  startTime: string       // "HH:MM"
  endTime?: string        // "HH:MM" – pouze view módy
  courtTimeFrom: string   // "07:00"
  courtTimeTo: string     // "21:00"
  maxDurationMinutes: number
  requirePartner: boolean
  /** Obsazené intervaly kurtu pro daný den */
  busyIntervals: Array<{
    start: string        // "HH:MM"
    end: string          // "HH:MM"
    userName?: string | null
    isOwn?: boolean
  }>
  orgMembers: OrgMember[]
  currentUserId?: string
  reservation?: {
    id: string
    userId: string
    userFullName: string | null
    partnerName: string | null
    note: string | null
  }
}

type Props = {
  data: DialogData
  onClose: () => void
  onSuccess: (created?: import('./ReservationGrid').Reservation, cancelledId?: string) => void
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function gen30Slots(from: string, to: string) {
  const slots: { start: string; end: string }[] = []
  let t = timeToMin(from)
  const end = timeToMin(to)
  while (t + 30 <= end) {
    slots.push({ start: minToTime(t), end: minToTime(t + 30) })
    t += 30
  }
  return slots
}

/** Praha local time → UTC ISO string (Z trick pro správný offset) */
function toUTC(dateStr: string, timeStr: string): string {
  const probe = new Date(`${dateStr}T${timeStr}:00Z`)
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    timeZoneName: 'shortOffset',
  }).formatToParts(probe).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2'
  const off = parseInt(tz.match(/GMT([+-]\d+)/)?.[1] ?? '2', 10)
  return new Date(probe.getTime() - off * 3_600_000).toISOString()
}

// ---------------------------------------------------------------------------
// Komponenta
// ---------------------------------------------------------------------------

export default function ReservationDialog({ data, onClose, onSuccess }: Props) {
  const {
    mode, court, date, organizationId,
    startTime: initialStart, endTime: viewEnd,
    courtTimeFrom, courtTimeTo,
    maxDurationMinutes, requirePartner,
    busyIntervals, orgMembers, reservation,
  } = data

  // === Výběr časového úseku ===
  const [selStart, setSelStart] = useState<string>(initialStart)
  const [selEnd, setSelEnd] = useState<string | null>(null)

  // === Formulář ===
  const [partnerQuery, setPartnerQuery] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [showSugg, setShowSugg] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // === Sloty = celý provozní čas kurtu ===
  const slots = useMemo(
    () => gen30Slots(courtTimeFrom, courtTimeTo),
    [courtTimeFrom, courtTimeTo]
  )

  // === Auto-scroll do oblasti kliknutého času ===
  const slotsContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!slotsContainerRef.current) return
    const targetMin = Math.max(timeToMin(courtTimeFrom), timeToMin(initialStart) - 60)
    const targetTime = minToTime(targetMin)
    const idx = slots.findIndex(s => s.start >= targetTime)
    if (idx > 0) slotsContainerRef.current.scrollTop = idx * 30  // h-[1.875rem] = 30px
  }, [])  // pouze při mountu

  // === Autocomplete spoluhráče ===
  const suggestions = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase()
    if (!q) return []
    return orgMembers.filter(m => m.fullName.toLowerCase().includes(q)).slice(0, 6)
  }, [partnerQuery, orgMembers])

  // === Helpers ===
  function getBusyAt(slot: { start: string; end: string }) {
    return busyIntervals.find(b => b.start < slot.end && b.end > slot.start) ?? null
  }

  function hasBusyBetween(from: string, to: string) {
    return busyIntervals.some(b => b.start < to && b.end > from)
  }

  function inSelection(slot: { start: string; end: string }) {
    if (!selEnd) return slot.start === selStart
    return slot.start >= selStart && slot.start < selEnd
  }

  function handleSlotClick(slot: { start: string; end: string }) {
    const busy = getBusyAt(slot)
    if (busy) return  // obsazený slot není klikatelný

    // Pokud je výběr kompletní (start+end), klik kamkoliv = nový výběr
    if (selEnd !== null) {
      setSelStart(slot.start)
      setSelEnd(null)
      return
    }

    // Výběr startu ještě není potvrzen koncem
    if (slot.start < selStart) {
      // Posunout start dříve
      if (hasBusyBetween(slot.start, selStart)) return
      setSelStart(slot.start)
      return
    }

    if (slot.start === selStart) {
      // Klik na start znovu = čekáme na konec (nic)
      return
    }

    // Nastavit konec — dur <= maxDurationMinutes (= včetně limitu)
    if (hasBusyBetween(selStart, slot.end)) return
    const dur = timeToMin(slot.end) - timeToMin(selStart)
    if (dur > maxDurationMinutes) return
    setSelEnd(slot.end)
  }

  const durationMin = selEnd ? timeToMin(selEnd) - timeToMin(selStart) : 0
  const durationLabel = (() => {
    if (!durationMin) return ''
    const h = Math.floor(durationMin / 60)
    const m = durationMin % 60
    return `${h > 0 ? h + 'h' : ''}${h > 0 && m > 0 ? ' ' : ''}${m > 0 ? m + ' min' : ''}`
  })()

  const dateFormatted = new Date(`${date}T12:00:00Z`).toLocaleDateString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Prague',
  })

  function handleCreate() {
    if (!selEnd) { setError('Vyberte konec rezervace kliknutím na slot.'); return }
    if (requirePartner && !partnerName.trim()) {
      setError('Vyplňte jméno spoluhráče — je to povinné pro tento kurt.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createReservation({
        courtId: court.id, organizationId,
        startTimeISO: toUTC(date, selStart),
        endTimeISO: toUTC(date, selEnd!),
        partnerName: partnerName.trim() || undefined,
        note: note.trim() || undefined,
      })
      if (result.success) {
        // Optimistický objekt pro okamžité zobrazení
        const optimistic: import('./ReservationGrid').Reservation = {
          id: result.id,
          courtId: court.id,
          userId: data.currentUserId || '',  // optimistic = ihned 'mine'
          startTime: toUTC(date, selStart),
          endTime: toUTC(date, selEnd!),
          status: 'confirmed',
          partnerName: partnerName.trim() || null,
          note: note.trim() || null,
          userFullName: null,
        }
        onSuccess(optimistic, undefined)
        onClose()
      } else setError(result.error)
    })
  }

  function handleCancel() {
    if (!reservation) return
    setError(null)
    startTransition(async () => {
      const result = await cancelReservation(reservation.id)
      if (result.success) { onSuccess(undefined, reservation.id); onClose() }
      else setError(result.error)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Hlavička */}
        <div className="flex items-start justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{court.name}</h2>
            <p className="text-xs text-gray-400 capitalize">{dateFormatted}</p>
            <p className="text-base font-bold text-gray-800 mt-0.5">
              {mode === 'create'
                ? selEnd
                  ? `${selStart} – ${selEnd}`
                  : `od ${selStart} → vyberte konec`
                : `${data.startTime} – ${viewEnd}`}
              {durationLabel && mode === 'create' && (
                <span className="text-sm font-normal text-gray-400 ml-2">{durationLabel}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="ml-2 mt-1 p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ── CREATE MODE ── */}
          {mode === 'create' && (<>

            {/* Spoluhráč */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Spoluhráč{' '}
                {requirePartner
                  ? <span className="text-red-500 font-normal">*povinné</span>
                  : <span className="text-gray-400 font-normal">(nepovinné)</span>}
              </label>
              <input
                type="text"
                value={partnerQuery}
                onChange={e => {
                  setPartnerQuery(e.target.value)
                  setPartnerName(e.target.value)
                  setShowSugg(true)
                }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                placeholder="Začněte psát jméno…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                maxLength={100}
              />
              {showSugg && suggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  {suggestions.map(m => (
                    <button
                      key={m.id}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 hover:text-green-800 border-b border-gray-50 last:border-0"
                      onClick={() => {
                        setPartnerName(m.fullName)
                        setPartnerQuery(m.fullName)
                        setShowSugg(false)
                      }}
                    >
                      {m.fullName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Poznámka */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Poznámka <span className="text-gray-400 font-normal">(nepovinné)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Trénink, přátelská, turnaj…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                maxLength={200}
              />
            </div>

            {/* Mini grid — celý den kurtu */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                {selEnd
                  ? 'Klikněte kamkoliv pro nový výběr'
                  : selStart
                  ? 'Klikněte na konec rezervace ↓'
                  : 'Klikněte na začátek rezervace ↓'}
              </p>
              {maxDurationMinutes < 600 && (
                <p className="text-xs text-gray-400 mb-2">
                  Max. délka:{' '}
                  {maxDurationMinutes >= 60
                    ? Math.floor(maxDurationMinutes / 60) + 'h'
                    : ''
                  }{maxDurationMinutes % 60 ? ' ' + maxDurationMinutes % 60 + ' min' : ''}
                </p>
              )}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div ref={slotsContainerRef} className="max-h-[270px] overflow-y-auto">
                {slots.map(slot => {
                  const busy = getBusyAt(slot)
                  const occupied = busy !== null
                  const inSel = inSelection(slot)
                  const isSelStart = slot.start === selStart
                  const isSelEnd = Boolean(selEnd && slot.end === selEnd)
                  const isHour = slot.start.endsWith(':00')
                  const isFirstBusy = occupied && busy!.start === slot.start

                  // Přes limit délky (exkluzivní: dur > maxDuration znamená nelze kliknout)
                  const overMax = !occupied && !inSel && selEnd === null &&
                    slot.start > selStart &&
                    (timeToMin(slot.end) - timeToMin(selStart)) > maxDurationMinutes

                  // Blokováno obsazeným slotem v cestě
                  const blockedPath = !occupied && !inSel && !overMax &&
                    selEnd === null && slot.start > selStart &&
                    hasBusyBetween(selStart, slot.end)

                  const notClickable = occupied

                  let cellClass = ''
                  if (occupied) {
                    cellClass = busy!.isOwn ? 'bg-blue-100' : 'bg-red-50'
                  } else if (inSel) {
                    cellClass = isSelStart || isSelEnd ? 'bg-green-500' : 'bg-green-400'
                  } else if (overMax || blockedPath) {
                    cellClass = 'bg-gray-50 opacity-50'
                  } else {
                    cellClass = 'bg-white hover:bg-green-50'
                  }

                  return (
                    <div
                      key={slot.start}
                      onClick={() => !notClickable && handleSlotClick(slot)}
                      className={[
                        'flex items-center px-3 select-none h-[1.875rem]',
                        isHour ? 'border-t border-gray-300' : 'border-t border-dashed border-gray-100',
                        cellClass,
                        notClickable ? 'cursor-default' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      {/* Čas */}
                      <span className={[
                        'w-12 font-mono text-xs shrink-0',
                        inSel && !occupied ? 'text-white font-semibold' :
                        isHour ? 'text-gray-600 font-semibold' : 'text-gray-300',
                      ].join(' ')}>
                        {isHour ? slot.start : (isSelStart || isSelEnd ? slot.start : '')}
                      </span>

                      {/* Popisek */}
                      <span className="flex-1 pl-1 text-xs leading-tight truncate">
                        {isFirstBusy && busy!.isOwn && (
                          <span className="text-blue-700 font-medium">
                            ✓ Vaše: {busy!.start}–{busy!.end}
                          </span>
                        )}
                        {isFirstBusy && !busy!.isOwn && (
                          <span className="text-red-600">
                            {busy!.userName ?? 'Obsazeno'} ({busy!.start}–{busy!.end})
                          </span>
                        )}
                        {!occupied && isSelStart && !selEnd && (
                          <span className="text-green-700 font-medium">← začátek</span>
                        )}
                        {!occupied && isSelStart && Boolean(selEnd) && (
                          <span className="text-white text-[11px]">start</span>
                        )}
                        {!occupied && isSelEnd && (
                          <span className="text-white text-[11px] font-semibold">konec ✓</span>
                        )}
                        {overMax && (
                          <span className="text-gray-300 text-[11px]">nad limit</span>
                        )}
                      </span>
                    </div>
                  )
                })}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pb-1">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !selEnd}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Ukládám…' : selEnd ? 'Rezervovat' : 'Vyberte čas'}
              </button>
            </div>
          </>)}

          {/* ── VIEW-MINE ── */}
          {mode === 'view-mine' && reservation && (<>
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Vaše rezervace</p>
              <p className="text-blue-600">{data.startTime} – {viewEnd}</p>
              {reservation.partnerName && (
                <p>Spoluhráč: <span className="font-medium">{reservation.partnerName}</span></p>
              )}
              {reservation.note && <p>Poznámka: {reservation.note}</p>}
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Zavřít
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Ruším…' : 'Zrušit rezervaci'}
              </button>
            </div>
          </>)}

          {/* ── VIEW-TAKEN ── */}
          {mode === 'view-taken' && reservation && (<>
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
              <p className="font-semibold">Obsazeno</p>
              <p className="text-red-600">{data.startTime} – {viewEnd}</p>
              {reservation.userFullName && <p>Hráč: {reservation.userFullName}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Zavřít
            </button>
          </>)}

        </div>
      </div>
    </div>
  )
}
