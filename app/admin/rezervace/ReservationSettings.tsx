'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrgSettings } from './actions'

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

type RuleValues = {
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
}

const FALLBACK_RULES: RuleValues = {
  time_from: '07:00', time_to: '21:00', slot_minutes: 60,
  price_member: 0, price_guest: 100, max_advance_days: 14,
  max_duration_minutes: 120, min_gap_minutes: 0,
  max_per_week: null, require_partner: false,
}

type OrgSettings = {
  show_player_names?: boolean
  default_court_rules?: RuleValues
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Formulářová pole pravidel (sdílená)
// ---------------------------------------------------------------------------

function RuleFormFields({ defaults }: { defaults: RuleValues }) {
  return (
    <div className="space-y-5">
      {/* Provozní doba */}
      <fieldset>
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Provozní doba
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Začátek</label>
            <input type="time" name="time_from" defaultValue={defaults.time_from}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Konec</label>
            <input type="time" name="time_to" defaultValue={defaults.time_to}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Délka slotu</label>
            <select name="slot_minutes" defaultValue={String(defaults.slot_minutes)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="30">30 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Max. délka rezervace</label>
            <select name="max_duration_minutes" defaultValue={String(defaults.max_duration_minutes)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
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

      {/* Rezervační limity */}
      <fieldset>
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Rezervační limity
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Max. dní dopředu</label>
            <input type="number" name="max_advance_days" defaultValue={defaults.max_advance_days}
              min={1} max={90}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            <p className="mt-1 text-[10px] text-gray-400">1–90 dní</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Max. rezervací/týden <span className="font-normal text-gray-400">(na osobu)</span>
            </label>
            <input type="number" name="max_per_week"
              defaultValue={defaults.max_per_week ?? ''}
              min={1} max={21} placeholder="bez limitu"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Min. odstup (min)</label>
            <input type="number" name="min_gap_minutes" defaultValue={defaults.min_gap_minutes}
              min={0} max={1440} step={15}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-[10px] text-gray-400">0 = bez odstupu</p>
          </div>
        </div>
      </fieldset>

      {/* Ceny */}
      <fieldset>
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Ceny (Kč / hodina)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cena pro člena</label>
            <div className="relative">
              <input type="number" name="price_member" defaultValue={defaults.price_member}
                min={0} step={10}
                className="w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Kč</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cena pro hosta</label>
            <div className="relative">
              <input type="number" name="price_guest" defaultValue={defaults.price_guest}
                min={0} step={10}
                className="w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Kč</span>
            </div>
          </div>
        </div>
      </fieldset>

      {/* Doplňkové podmínky */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" name="require_partner" defaultChecked={defaults.require_partner}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
        <div>
          <div className="text-sm font-medium text-gray-800">Vyžadovat spoluhráče</div>
          <div className="text-xs text-gray-500">Hráč musí při rezervaci uvést jméno spoluhráče.</div>
        </div>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Karta: Nastavení oddílu
// ---------------------------------------------------------------------------

function OrgSettingsCard({
  orgSettings,
  orgDefaultRules,
}: {
  orgSettings: OrgSettings
  orgDefaultRules: RuleValues | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaults = orgDefaultRules ?? FALLBACK_RULES

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSaved(false); setError(null)
    startTransition(async () => {
      const result = await updateOrgSettings(formData)
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
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Nastavení oddílu</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Výchozí pravidla se automaticky aplikují na kurty se standardními pravidly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
        {/* Obecné nastavení */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Obecné</p>
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-sm font-medium text-gray-800">Zobrazovat jména hráčů</div>
              <div className="mt-0.5 text-xs text-gray-500">
                Vypnuto = ostatní členové vidí jen „Obsazeno“. Admin a manažer vidí jména vždy.
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center shrink-0">
              <input type="checkbox" name="show_player_names"
                defaultChecked={orgSettings.show_player_names !== false}
                className="sr-only peer" />
              <div className="h-6 w-11 rounded-full bg-gray-200
                peer-checked:bg-green-600
                after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5
                after:rounded-full after:border after:border-gray-300 after:bg-white
                after:transition-all after:content-['']
                peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>
        </div>

        {/* Výchozí pravidla kurtů */}
        <div className="border-t border-gray-100 pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Výchozí pravidla kurtů
          </p>
          <p className="mb-4 text-xs text-gray-400">
            Platí pro kurty s přepnutým přepínačem „Standardní pravidla oddílu“ ve správě kurtů.
          </p>
          <RuleFormFields defaults={defaults} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
          <button type="submit" disabled={isPending}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {isPending ? 'Ukládám…' : 'Uložit nastavení oddílu'}
          </button>
          {saved && <span className="text-sm font-medium text-green-600">✓ Uloženo</span>}
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hlavní export
// ---------------------------------------------------------------------------

export default function ReservationSettings({
  orgSettings,
  orgDefaultRules,
}: {
  orgSettings: OrgSettings
  orgDefaultRules: RuleValues | null
}) {
  return <OrgSettingsCard orgSettings={orgSettings} orgDefaultRules={orgDefaultRules} />
}
