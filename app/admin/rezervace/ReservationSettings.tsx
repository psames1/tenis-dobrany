'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrgReservationSettings, updateCourtRule } from './actions'

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

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

type OrgSettings = {
  show_player_names?: boolean
  [key: string]: unknown
}

const SURFACE_LABELS: Record<string, string> = {
  clay: 'Antuka',
  hard: 'Tvrdý povrch',
  grass: 'Tráva',
  indoor_hard: 'Hala (tvrdý)',
}

// ---------------------------------------------------------------------------
// Sekce: Nastavení organizace
// ---------------------------------------------------------------------------

function OrgSettingsCard({
  orgSettings,
}: {
  orgSettings: OrgSettings
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await updateOrgReservationSettings(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Nastavení oddílu</h2>
        <p className="text-xs text-gray-500 mt-0.5">Platí pro celý oddíl a všechny kurty.</p>
      </div>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

        {/* show_player_names */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-medium text-gray-800">Zobrazovat jména hráčů</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Pokud je vypnuto, ostatní členové v rezervačním gridu uvidí jen „Obsazeno" místo jména.
              Admin a manažer vidí jména vždy.
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              name="show_player_names"
              defaultChecked={orgSettings.show_player_names !== false}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:after:border-white
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:bg-white after:border-gray-300 after:border after:rounded-full
              after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? 'Ukládám…' : 'Uložit nastavení'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">✓ Uloženo</span>
          )}
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Řádek sumarizace pravidel
// ---------------------------------------------------------------------------

function RuleSummary({ rule }: { rule: NonNullable<CourtRule> }) {
  const h = Math.floor(rule.max_duration_minutes / 60)
  const m = rule.max_duration_minutes % 60
  const durationLabel = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m}min`
  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <span className="font-medium text-gray-700">Provoz</span>
        {rule.time_from}–{rule.time_to}
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium text-gray-700">Slot</span>
        {rule.slot_minutes} min
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium text-gray-700">Max. délka</span>
        {durationLabel}
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium text-gray-700">Dopředu</span>
        {rule.max_advance_days} dní
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium text-gray-700">Člen</span>
        {rule.price_member} Kč
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium text-gray-700">Host</span>
        {rule.price_guest} Kč
      </span>
      {rule.max_per_week && (
        <span className="flex items-center gap-1">
          <span className="font-medium text-gray-700">Max/týden</span>
          {rule.max_per_week}×
        </span>
      )}
      {rule.min_gap_minutes > 0 && (
        <span className="flex items-center gap-1">
          <span className="font-medium text-gray-700">Odstup</span>
          {rule.min_gap_minutes} min
        </span>
      )}
      {rule.require_partner && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-200">
          Vyžaduje spoluhráče
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulář pravidel pro jeden kurt
// ---------------------------------------------------------------------------

function CourtRuleForm({
  court,
  onCancel,
  onSaved,
}: {
  court: Court
  onCancel: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const rule = court.rule

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await updateCourtRule(court.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        onSaved()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Provozní doba */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Provozní doba
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Začátek provozu</label>
            <input
              type="time"
              name="time_from"
              defaultValue={rule?.time_from ?? '07:00'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Konec provozu</label>
            <input
              type="time"
              name="time_to"
              defaultValue={rule?.time_to ?? '21:00'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Délka slotu</label>
            <select
              name="slot_minutes"
              defaultValue={String(rule?.slot_minutes ?? 60)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="30">30 minut</option>
              <option value="60">60 minut</option>
              <option value="90">90 minut</option>
              <option value="120">120 minut</option>
            </select>
            <p className="mt-1 text-[10px] text-gray-400">Nejmenší jednotka rezervace.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max. délka rezervace</label>
            <select
              name="max_duration_minutes"
              defaultValue={String(rule?.max_duration_minutes ?? 120)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="30">30 min</option>
              <option value="60">1 hodina</option>
              <option value="90">1,5 hodiny</option>
              <option value="120">2 hodiny</option>
              <option value="180">3 hodiny</option>
              <option value="240">4 hodiny</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Rezervační horizont a limity */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Rezervační limity
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Max. dní dopředu
            </label>
            <input
              type="number"
              name="max_advance_days"
              defaultValue={rule?.max_advance_days ?? 14}
              min={1}
              max={90}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
            <p className="mt-1 text-[10px] text-gray-400">Jak daleko dopředu lze rezervovat.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Max. rezervací za týden{' '}
              <span className="font-normal text-gray-400">(na osobu)</span>
            </label>
            <input
              type="number"
              name="max_per_week"
              defaultValue={rule?.max_per_week ?? ''}
              min={1}
              max={21}
              placeholder="bez limitu"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Min. odstup mezi rez. (min)
            </label>
            <input
              type="number"
              name="min_gap_minutes"
              defaultValue={rule?.min_gap_minutes ?? 0}
              min={0}
              max={1440}
              step={15}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[10px] text-gray-400">0 = bez odstupu.</p>
          </div>
        </div>
      </fieldset>

      {/* Ceny */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Ceny (Kč / hodina)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cena pro člena</label>
            <div className="relative">
              <input
                type="number"
                name="price_member"
                defaultValue={rule?.price_member ?? 0}
                min={0}
                step={10}
                className="w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Kč</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cena pro hosta</label>
            <div className="relative">
              <input
                type="number"
                name="price_guest"
                defaultValue={rule?.price_guest ?? 100}
                min={0}
                step={10}
                className="w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Kč</span>
            </div>
          </div>
        </div>
      </fieldset>

      {/* Doplňkové podmínky */}
      <fieldset>
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Doplňkové podmínky
        </legend>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="require_partner"
            defaultChecked={rule?.require_partner ?? false}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <div className="text-sm font-medium text-gray-800">Vyžadovat spoluhráče</div>
            <div className="text-xs text-gray-500">
              Hráč musí při rezervaci uvést jméno spoluhráče.
            </div>
          </div>
        </label>
      </fieldset>

      {/* Tlačítka */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Zrušit
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? 'Ukládám…' : 'Uložit pravidla'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sekce: Pravidla pro kurty
// ---------------------------------------------------------------------------

function CourtRulesSection({ courts: initialCourts }: { courts: Court[] }) {
  const router = useRouter()
  const [courts] = useState(initialCourts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  function handleSaved(courtId: string) {
    setExpandedId(null)
    setSavedId(courtId)
    setTimeout(() => setSavedId(null), 3000)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Pravidla rezervací pro každý kurt</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Každý kurt může mít vlastní provozní dobu, ceny a limity.
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {courts.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            Žádné kurty. Nejprve přidejte kurty v sekci{' '}
            <a href="/admin/kurty" className="text-green-600 underline">Kurty</a>.
          </div>
        )}

        {courts.map(court => (
          <div key={court.id} className={court.active ? '' : 'opacity-50'}>
            {/* Hlavička kurtu */}
            <div className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{court.name}</span>
                    <span className="text-xs text-gray-400">
                      {SURFACE_LABELS[court.surface] ?? court.surface}
                      {court.indoor && ' · Hala'}
                    </span>
                    {!court.active && (
                      <span className="text-xs rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">Neaktivní</span>
                    )}
                    {savedId === court.id && (
                      <span className="text-xs text-green-600 font-medium">✓ Uloženo</span>
                    )}
                  </div>
                  {/* Aktuální pravidla — sumarizace */}
                  <div className="mt-2">
                    {court.rule ? (
                      <RuleSummary rule={court.rule} />
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">
                        ⚠ Žádná pravidla — kurt nebude dostupný pro rezervace
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === court.id ? null : court.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                    expandedId === court.id
                      ? 'bg-gray-100 border-gray-200 text-gray-700'
                      : court.rule
                        ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {expandedId === court.id ? 'Zavřít' : court.rule ? 'Upravit' : 'Nastavit pravidla'}
                </button>
              </div>
            </div>

            {/* Rozbalený formulář */}
            {expandedId === court.id && (
              <div className="px-6 pb-6 border-t border-gray-100 pt-4 bg-gray-50 rounded-b-xl">
                <CourtRuleForm
                  court={court}
                  onCancel={() => setExpandedId(null)}
                  onSaved={() => handleSaved(court.id)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hlavní export
// ---------------------------------------------------------------------------

export default function ReservationSettings({
  courts,
  organizationId: _organizationId,
  orgSettings,
}: {
  courts: Court[]
  organizationId: string
  orgSettings: OrgSettings
}) {
  return (
    <div className="space-y-6">
      <OrgSettingsCard orgSettings={orgSettings} />
      <CourtRulesSection courts={courts} />
    </div>
  )
}
