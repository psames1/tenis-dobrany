'use client'

import { useState, useTransition } from 'react'
import { createReservation, cancelReservation } from './actions'

export type DialogMode = 'create' | 'view-mine' | 'view-taken'

export type DialogData = {
  mode: DialogMode
  court: { id: string; name: string }
  date: string            // YYYY-MM-DD (Praha timezone)
  organizationId: string
  startTime: string       // "HH:MM" – pro create: vybraný začátek; pro view: skutečný začátek
  endTime?: string        // "HH:MM" – pouze pro view módy: skutečný konec
  courtTimeTo: string     // "21:00" – horní limit pro výběr konce (pro create)
  busyIntervals: Array<{ start: string; end: string }> // obsazené intervaly (HH:MM) pro tento kurt
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
  onSuccess: () => void
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Kandidáti na konec rezervace (každých 30 min od start+30 do maxEnd) */
function computeCandidates(startTime: string, busyIntervals: Array<{start:string;end:string}>, courtTimeTo: string): string[] {
  // Najdi první obsazený interval začínající ROVNOU nebo PO startTime
  const firstBusy = busyIntervals
    .filter(b => b.start > startTime)
    .sort((a, b) => a.start.localeCompare(b.start))[0]

  const maxEnd = firstBusy ? firstBusy.start : courtTimeTo
  const maxTotal = timeToMin(maxEnd)
  const candidates: string[] = []
  let t = timeToMin(startTime) + 30
  while (t <= maxTotal) {
    candidates.push(minToTime(t))
    t += 30
  }
  return candidates
}

/** Sestaví UTC timestamp z data + Praha-lokálního HH:MM */
function buildUTCTimestamp(dateStr: string, timeStr: string): string {
  const naive = new Date(`${dateStr}T${timeStr}:00`)
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    timeZoneName: 'shortOffset',
  }).formatToParts(naive).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const match = tz.match(/GMT([+-]\d+)/)
  const offsetHours = parseInt(match?.[1] ?? '1', 10)
  return new Date(naive.getTime() - offsetHours * 3_600_000).toISOString()
}

export default function ReservationDialog({ data, onClose, onSuccess }: Props) {
  const { mode, court, date, organizationId, startTime, endTime, courtTimeTo, busyIntervals, reservation } = data

  // Výběr konce rezervace (pouze v create módu)
  const candidates = mode === 'create'
    ? computeCandidates(startTime, busyIntervals, courtTimeTo)
    : []

  // Předvyber 2. možnost (= 1 hodina), nebo 1. pokud je jen jedna
  const defaultEnd = candidates[1] ?? candidates[0] ?? null
  const [selectedEnd, setSelectedEnd] = useState<string | null>(defaultEnd)

  const [partnerName, setPartnerName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Datum v čitelném formátu
  const dateFormatted = new Date(`${date}T12:00:00Z`).toLocaleDateString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Prague',
  })

  // Čas zobrazený v hlavičce
  const headerTime =
    mode === 'create'
      ? selectedEnd ? `${startTime} – ${selectedEnd}` : `od ${startTime}`
      : `${startTime} – ${endTime}`

  function handleCreate() {
    if (!selectedEnd) {
      setError('Vyberte čas do kdy chcete rezervovat.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createReservation({
        courtId: court.id,
        organizationId,
        startTimeISO: buildUTCTimestamp(date, startTime),
        endTimeISO: buildUTCTimestamp(date, selectedEnd),
        partnerName: partnerName || undefined,
        note: note || undefined,
      })
      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error)
      }
    })
  }

  function handleCancel() {
    if (!reservation) return
    setError(null)
    startTransition(async () => {
      const result = await cancelReservation(reservation.id)
      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Hlavička */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{court.name}</h2>
            <p className="text-sm text-gray-500 capitalize">{dateFormatted}</p>
            <p className={`mt-0.5 text-base font-medium ${mode === 'create' && !selectedEnd ? 'text-gray-400' : 'text-gray-800'}`}>
              {headerTime}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-1 text-gray-400 hover:text-gray-600"
            aria-label="Zavřít"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Obsah */}
        <div className="px-6 py-4 space-y-4">

          {/* ---- CREATE: výběr konce + formulář ---- */}
          {mode === 'create' && (
            <>
              {/* Výběr konce rezervace */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Do kdy chcete hrát?</p>
                {candidates.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    Žádný volný čas od {startTime} — kurt je plně obsazený.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {candidates.map(end => {
                      const durationMin = timeToMin(end) - timeToMin(startTime)
                      const durationLabel = durationMin >= 60
                        ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? durationMin % 60 + 'min' : ''}`
                        : `${durationMin} min`
                      const isSelected = selectedEnd === end
                      return (
                        <button
                          key={end}
                          onClick={() => setSelectedEnd(end)}
                          className={`rounded-xl py-2.5 px-2 text-center transition-all border ${
                            isSelected
                              ? 'bg-green-600 text-white border-green-600 shadow-md ring-2 ring-green-300'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-green-50 hover:border-green-300'
                          }`}
                        >
                          <span className="block text-sm font-semibold">{end}</span>
                          <span className={`block text-xs mt-0.5 ${isSelected ? 'text-green-100' : 'text-gray-400'}`}>
                            {durationLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Spoluhráč */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Spoluhráč <span className="font-normal text-gray-400">(nepovinné)</span>
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Jméno spoluhráče"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  maxLength={100}
                />
              </div>

              {/* Poznámka */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Poznámka <span className="font-normal text-gray-400">(nepovinné)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Trénink, přátelská, ..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  maxLength={300}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isPending || !selectedEnd || candidates.length === 0}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Ukládám…' : selectedEnd ? `Rezervovat do ${selectedEnd}` : 'Vyberte čas'}
                </button>
              </div>
            </>
          )}

          {/* ---- VIEW-MINE: zobrazení vlastní rezervace ---- */}
          {mode === 'view-mine' && reservation && (
            <>
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
                <p className="font-medium">Vaše rezervace</p>
                {reservation.partnerName && <p>Spoluhráč: {reservation.partnerName}</p>}
                {reservation.note && <p>Poznámka: {reservation.note}</p>}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Zavřít
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? 'Ruším…' : 'Zrušit rezervaci'}
                </button>
              </div>
            </>
          )}

          {/* ---- VIEW-TAKEN: zobrazení cizí rezervace ---- */}
          {mode === 'view-taken' && reservation && (
            <>
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
                <p className="font-medium">Obsazeno</p>
                {reservation.userFullName && <p>Hráč: {reservation.userFullName}</p>}
              </div>

              <button
                onClick={onClose}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Zavřít
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
