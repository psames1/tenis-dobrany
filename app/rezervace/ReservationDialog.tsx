'use client'

import { useState, useTransition } from 'react'
import { createReservation, cancelReservation } from './actions'

export type DialogMode = 'create' | 'view-mine' | 'view-taken'

export type DialogData = {
  mode: DialogMode
  court: { id: string; name: string }
  slot: { start: string; end: string }
  date: string  // YYYY-MM-DD (Praha timezone)
  organizationId: string
  // pouze pro mode 'view-mine' | 'view-taken'
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

export default function ReservationDialog({ data, onClose, onSuccess }: Props) {
  const [partnerName, setPartnerName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { mode, court, slot, date, organizationId, reservation } = data

  // Sestavení UTC timestampů z datum + čas (Praha timezone)
  // Předpoklad: klient je v CZ timezone — pro spolehlivost použijeme Intl offset
  function buildUTCTimestamp(dateStr: string, timeStr: string): string {
    // Zjistit offset pro Praha timezone v daný čas
    const naive = new Date(`${dateStr}T${timeStr}:00`)
    const pragueParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Prague',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(naive)
    const tz = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Prague',
      timeZoneName: 'shortOffset',
    }).formatToParts(naive).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1'

    const match = tz.match(/GMT([+-]\d+)/)
    const offsetHours = parseInt(match?.[1] ?? '1', 10)
    const utc = new Date(naive.getTime() - offsetHours * 3600 * 1000)
    return utc.toISOString()
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createReservation({
        courtId: court.id,
        organizationId,
        startTimeISO: buildUTCTimestamp(date, slot.start),
        endTimeISO: buildUTCTimestamp(date, slot.end),
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

  // Datum v čitelném formátu
  const dateFormatted = new Date(`${date}T12:00:00`).toLocaleDateString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Hlavička */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{court.name}</h2>
            <p className="text-sm text-gray-500 capitalize">{dateFormatted}</p>
            <p className="mt-0.5 text-base font-medium text-gray-700">
              {slot.start} – {slot.end}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600"
            aria-label="Zavřít"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Obsah */}
        <div className="px-6 py-4">
          {mode === 'create' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Vytvořit rezervaci na tento termín?</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Spoluhráč (nepovinné)
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Poznámka (nepovinné)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Trénink, turnaj, ..."
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
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isPending ? 'Ukládám...' : 'Rezervovat'}
                </button>
              </div>
            </div>
          )}

          {mode === 'view-mine' && reservation && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <p className="font-medium">Vaše rezervace</p>
                {reservation.partnerName && (
                  <p className="mt-1">Spoluhráč: {reservation.partnerName}</p>
                )}
                {reservation.note && (
                  <p className="mt-1">Poznámka: {reservation.note}</p>
                )}
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
                  {isPending ? 'Ruším...' : 'Zrušit rezervaci'}
                </button>
              </div>
            </div>
          )}

          {mode === 'view-taken' && reservation && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium">Obsazeno</p>
                <p className="mt-1">
                  {reservation.userFullName ?? 'Člen klubu'}
                  {reservation.partnerName && ` + ${reservation.partnerName}`}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Zavřít
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
