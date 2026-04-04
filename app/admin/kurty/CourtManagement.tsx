'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCourt, toggleCourtActive, updateCourtRule, deleteCourt } from './actions'

type CourtRule = {
  court_id: string
  time_from: string
  time_to: string
  slot_minutes: number
  price_member: number
  price_guest: number
  max_advance_days: number
  max_duration_minutes: number
  min_gap_minutes: number
  max_per_week: number | null
  require_partner: boolean
} | null

type Court = {
  id: string
  name: string
  surface: string
  indoor: boolean
  active: boolean
  sort_order: number
  rule: CourtRule
}

const SURFACE_LABELS: Record<string, string> = {
  clay: 'Antuka',
  hard: 'Tvrdý povrch',
  grass: 'Tráva',
  indoor_hard: 'Hala (tvrdý)',
}

export default function CourtManagement({
  courts: initialCourts,
  organizationId,
}: {
  courts: Court[]
  organizationId: string
}) {
  const router = useRouter()
  const [courts, setCourts] = useState(initialCourts)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Sync state when server provides fresh data after revalidation
  useEffect(() => {
    setCourts(initialCourts)
  }, [initialCourts])

  function handleToggleActive(courtId: string, current: boolean) {
    startTransition(async () => {
      const result = await toggleCourtActive(courtId, !current)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleRuleSubmit(courtId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateCourtRule(courtId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setExpandedRule(null)
        router.refresh()
      }
    })
  }

  function handleDelete(courtId: string) {
    startTransition(async () => {
      const result = await deleteCourt(courtId)
      if (result.error) {
        setError(result.error)
        setConfirmDelete(null)
      } else {
        setConfirmDelete(null)
        router.refresh()
      }
    })
  }

  function handleNewCourt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createCourt(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setShowNewForm(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Zavřít</button>
        </div>
      )}

      {/* Seznam kurtů */}
      <div className="space-y-3">
        {courts.length === 0 && (
          <p className="text-gray-400 text-sm">Žádné kurty. Přidejte první kurt níže.</p>
        )}
        {courts.map(court => (
          <div
            key={court.id}
            className={`rounded-xl border bg-white shadow-sm transition-all ${court.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
          >
            {/* Hlavička kurtu */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <span className="font-semibold text-gray-900">{court.name}</span>
                <span className="ml-2 text-sm text-gray-400">
                  {SURFACE_LABELS[court.surface] ?? court.surface}
                  {court.indoor && ' · Hala'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={() => setExpandedRule(expandedRule === court.id ? null : court.id)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {expandedRule === court.id ? 'Skrýt pravidla' : 'Pravidla'}
                </button>
                <button
                  onClick={() => handleToggleActive(court.id, court.active)}
                  disabled={isPending}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    court.active
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {court.active ? 'Deaktivovat' : 'Aktivovat'}
                </button>
                {/* Trvalé smazání — pouze pro neaktivní kurty */}
                {!court.active && (
                  confirmDelete === court.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-700 font-medium">Opravdu smazat?</span>
                      <button
                        onClick={() => handleDelete(court.id)}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Smazat
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded px-2 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        Zrušit
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(court.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      Smazat trvale
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Stav pravidel */}
            {court.rule && expandedRule !== court.id && (
              <div className="px-5 pb-3 text-xs text-gray-400">
                {court.rule.time_from}–{court.rule.time_to} · slot {court.rule.slot_minutes} min · max {Math.floor((court.rule.max_duration_minutes ?? 120) / 60)}h · člen {court.rule.price_member} Kč · host {court.rule.price_guest} Kč · max {court.rule.max_advance_days} dní
              </div>
            )}

            {/* Formulář pravidel */}
            {expandedRule === court.id && (
              <form
                onSubmit={(e) => handleRuleSubmit(court.id, e)}
                className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 gap-3 bg-gray-50 rounded-b-xl"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provoz od</label>
                  <input
                    type="time"
                    name="time_from"
                    defaultValue={court.rule?.time_from ?? '07:00'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provoz do</label>
                  <input
                    type="time"
                    name="time_to"
                    defaultValue={court.rule?.time_to ?? '21:00'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Délka slotu</label>
                  <select
                    name="slot_minutes"
                    defaultValue={String(court.rule?.slot_minutes ?? 60)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="30">30 minut</option>
                    <option value="60">60 minut</option>
                    <option value="90">90 minut</option>
                    <option value="120">120 minut</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Max. dní dopředu</label>
                  <input
                    type="number"
                    name="max_advance_days"
                    defaultValue={court.rule?.max_advance_days ?? 14}
                    min={1}
                    max={90}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cena člen (Kč)</label>
                  <input
                    type="number"
                    name="price_member"
                    defaultValue={court.rule?.price_member ?? 0}
                    min={0}
                    step={10}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cena host (Kč)</label>
                  <input
                    type="number"
                    name="price_guest"
                    defaultValue={court.rule?.price_guest ?? 100}
                    min={0}
                    step={10}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2 border-t border-gray-200 mt-1 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Rozšířená pravidla</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max. délka (min)</label>
                      <input
                        type="number"
                        name="max_duration_minutes"
                        defaultValue={(court.rule as any)?.max_duration_minutes ?? 120}
                        min={30}
                        max={480}
                        step={30}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Min. odstup (min)</label>
                      <input
                        type="number"
                        name="min_gap_minutes"
                        defaultValue={(court.rule as any)?.min_gap_minutes ?? 0}
                        min={0}
                        max={1440}
                        step={15}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max. rezervací/týden</label>
                      <input
                        type="number"
                        name="max_per_week"
                        defaultValue={(court.rule as any)?.max_per_week ?? ''}
                        min={1}
                        max={21}
                        placeholder="bez limitu"
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="require_partner"
                          defaultChecked={(court.rule as any)?.require_partner ?? false}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs font-medium text-gray-600">Vyžadovat spoluhráče</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedRule(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {isPending ? 'Ukládám...' : 'Uložit pravidla'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Přidání nového kurtu */}
      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-5 py-4 text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors w-full"
        >
          <span className="text-lg">+</span>
          Přidat kurt
        </button>
      ) : (
        <form
          onSubmit={handleNewCourt}
          className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4"
        >
          <h3 className="font-semibold text-gray-800">Nový kurt</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Název kurtu *</label>
              <input
                type="text"
                name="name"
                placeholder="Např. Kurt 4"
                required
                maxLength={50}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Povrch</label>
              <select
                name="surface"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="clay">Antuka</option>
                <option value="hard">Tvrdý povrch</option>
                <option value="grass">Tráva</option>
                <option value="indoor_hard">Hala (tvrdý)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" name="indoor" id="indoor" className="rounded" />
              <label htmlFor="indoor" className="text-sm text-gray-600">Krytý / hala</label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? 'Přidávám...' : 'Přidat kurt'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
