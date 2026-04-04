'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrgSettings, setCourtUseDefaults, updateCourtRule } from './actions'

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

type Court = {
  id: string
  name: string
  surface: string
  indoor: boolean
  active: boolean
  useOrgDefaults: boolean
  rule: RuleValues | null
}

type OrgSettings = {
  show_player_names?: boolean
  default_court_rules?: RuleValues
  [key: string]: unknown
}

const SURFACE_LABELS: Record<string, string> = {
  clay: 'Antuka', hard: 'TvrdĂ˝ povrch', grass: 'TrĂˇva', indoor_hard: 'Hala (tvrdĂ˝)',
}

// ---------------------------------------------------------------------------
// Reusable: souhrn pravidel jako chipsy
// ---------------------------------------------------------------------------

function RuleSummary({ rule }: { rule: RuleValues }) {
  const h = Math.floor(rule.max_duration_minutes / 60)
  const m = rule.max_duration_minutes % 60
  const durLabel = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m}min`
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
      <span><b className="text-gray-700">Provoz</b> {rule.time_from}â€“{rule.time_to}</span>
      <span><b className="text-gray-700">Slot</b> {rule.slot_minutes} min</span>
      <span><b className="text-gray-700">Max. dĂ©lka</b> {durLabel}</span>
      <span><b className="text-gray-700">DopĹ™edu</b> {rule.max_advance_days} dnĂ­</span>
      <span><b className="text-gray-700">ÄŚlen</b> {rule.price_member} KÄŤ</span>
      <span><b className="text-gray-700">Host</b> {rule.price_guest} KÄŤ</span>
      {rule.max_per_week && <span><b className="text-gray-700">Max/tĂ˝den</b> {rule.max_per_week}Ă—</span>}
      {rule.min_gap_minutes > 0 && <span><b className="text-gray-700">Odstup</b> {rule.min_gap_minutes} min</span>}
      {rule.require_partner && (
        <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2">
          VyĹľaduje spoluhrĂˇÄŤe
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reusable: formulĂˇĹ™ovĂˇ pole pravidel
// ---------------------------------------------------------------------------

function RuleFormFields({ defaults }: { defaults: RuleValues }) {
  return (
    <div className="space-y-5">
      {/* ProvoznĂ­ doba */}
      <fieldset>
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          ProvoznĂ­ doba
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">ZaÄŤĂˇtek</label>
            <input type="time" name="time_from" defaultValue={defaults.time_from}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Konec</label>
            <input type="time" name="time_to" defaultValue={defaults.time_to}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">DĂ©lka slotu</label>
            <select name="slot_minutes" defaultValue={String(defaults.slot_minutes)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="30">30 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Max. dĂ©lka rezervace</label>
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

      {/* Limity */}
      <fieldset>
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          RezervaÄŤnĂ­ limity
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Max. dnĂ­ dopĹ™edu</label>
            <input type="number" name="max_advance_days" defaultValue={defaults.max_advance_days}
              min={1} max={90}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            <p className="mt-1 text-[10px] text-gray-400">1â€“90 dnĂ­</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Max. rezervacĂ­/tĂ˝den <span className="font-normal text-gray-400">(na osobu)</span>
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
          Ceny (KÄŤ / hodina)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cena pro ÄŤlena</label>
            <div className="relative">
              <input type="number" name="price_member" defaultValue={defaults.price_member}
                min={0} step={10}
                className="w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">KÄŤ</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cena pro hosta</label>
            <div className="relative">
              <input type="number" name="price_guest" defaultValue={defaults.price_guest}
                min={0} step={10}
                className="w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">KÄŤ</span>
            </div>
          </div>
        </div>
      </fieldset>

      {/* DoplĹkovĂ© podmĂ­nky */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" name="require_partner" defaultChecked={defaults.require_partner}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
        <div>
          <div className="text-sm font-medium text-gray-800">VyĹľadovat spoluhrĂˇÄŤe</div>
          <div className="text-xs text-gray-500">HrĂˇÄŤ musĂ­ pĹ™i rezervaci uvĂ©st jmĂ©no spoluhrĂˇÄŤe.</div>
        </div>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Karta: NastavenĂ­ oddĂ­lu (obecnĂ© + vĂ˝chozĂ­ pravidla)
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
        <h2 className="font-semibold text-gray-900">NastavenĂ­ oddĂ­lu</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          VĂ˝chozĂ­ pravidla se automaticky aplikujĂ­ na vĹˇechny kurty se standardnĂ­mi pravidly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
        {/* ObecnĂ© nastavenĂ­ */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">ObecnĂ©</p>
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-sm font-medium text-gray-800">Zobrazovat jmĂ©na hrĂˇÄŤĹŻ</div>
              <div className="mt-0.5 text-xs text-gray-500">
                Vypnuto = ostatnĂ­ ÄŤlenovĂ© vidĂ­ jen â€žObsazeno". Admin a manaĹľer vidĂ­ jmĂ©na vĹľdy.
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

        {/* VĂ˝chozĂ­ pravidla kurtĹŻ */}
        <div className="border-t border-gray-100 pt-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            VĂ˝chozĂ­ pravidla kurtĹŻ
          </p>
          <RuleFormFields defaults={defaults} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
          <button type="submit" disabled={isPending}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {isPending ? 'UklĂˇdĂˇmâ€¦' : 'UloĹľit nastavenĂ­ oddĂ­lu'}
          </button>
          {saved && <span className="text-sm font-medium text-green-600">âś“ UloĹľeno</span>}
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormulĂˇĹ™ vlastnĂ­ch pravidel kurtu
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
  const defaults = court.rule ?? FALLBACK_RULES

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await updateCourtRule(court.id, formData)
      if (result.error) setError(result.error)
      else onSaved()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <RuleFormFields defaults={defaults} />
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          ZruĹˇit
        </button>
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
          {isPending ? 'UklĂˇdĂˇmâ€¦' : 'UloĹľit vlastnĂ­ pravidla'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Karta: Pravidla pro jednotlivĂ© kurty
// ---------------------------------------------------------------------------

function CourtRulesCard({
  courts: initialCourts,
  orgDefaultRules,
}: {
  courts: Court[]
  orgDefaultRules: RuleValues | null
}) {
  const router = useRouter()
  const [courts, setCourts] = useState(initialCourts)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleToggleDefault(courtId: string, checked: boolean) {
    setPendingId(courtId)
    startTransition(async () => {
      const result = await setCourtUseDefaults(courtId, checked)
      setPendingId(null)
      if (!result.error) {
        setCourts(prev => prev.map(c => c.id === courtId ? { ...c, useOrgDefaults: checked } : c))
        if (checked) setExpanded(null)
        router.refresh()
      }
    })
  }

  function handleSaved(courtId: string) {
    setExpanded(null)
    setSavedId(courtId)
    setTimeout(() => setSavedId(null), 3000)
    router.refresh()
  }

  const effectiveDefaultRule = orgDefaultRules ?? FALLBACK_RULES

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Pravidla pro jednotlivĂ© kurty</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Kurty se standardnĂ­mi pravidly oddĂ­lu se automaticky aktualizujĂ­ pĹ™i zmÄ›nÄ› vĂ˝chozĂ­ch pravidel vĂ˝Ĺˇe.
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {courts.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            Ĺ˝ĂˇdnĂ© kurty. PĹ™idejte je v sekci{' '}
            <a href="/admin/kurty" className="text-green-600 underline">Kurty</a>.
          </div>
        )}

        {courts.map(court => (
          <div key={court.id} className={court.active ? '' : 'opacity-50'}>
            <div className="px-6 py-4">
              {/* ZĂˇhlavĂ­ kurtu */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{court.name}</span>
                    <span className="text-xs text-gray-400">
                      {SURFACE_LABELS[court.surface] ?? court.surface}
                      {court.indoor && ' Â· Hala'}
                    </span>
                    {!court.active && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">NeaktivnĂ­</span>
                    )}
                    {savedId === court.id && (
                      <span className="text-xs font-medium text-green-600">âś“ UloĹľeno</span>
                    )}
                  </div>

                  {/* Souhrn pravidel */}
                  <div className="mt-2">
                    {court.useOrgDefaults ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                          âś“ StandardnĂ­ pravidla oddĂ­lu
                        </span>
                        <RuleSummary rule={effectiveDefaultRule} />
                      </div>
                    ) : court.rule ? (
                      <RuleSummary rule={court.rule} />
                    ) : (
                      <span className="text-xs font-medium text-amber-600">âš  Ĺ˝ĂˇdnĂˇ pravidla</span>
                    )}
                  </div>
                </div>

                {/* TlaÄŤĂ­tko upravit (jen u kurzĹŻ s vlastnĂ­mi pravidly) */}
                {!court.useOrgDefaults && (
                  <button
                    onClick={() => setExpanded(expanded === court.id ? null : court.id)}
                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {expanded === court.id ? 'ZavĹ™Ă­t' : 'Upravit'}
                  </button>
                )}
              </div>

              {/* Checkbox: standardnĂ­ pravidla */}
              <label className={`mt-3 flex items-center gap-2.5 cursor-pointer w-fit ${pendingId === court.id ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="checkbox"
                  checked={court.useOrgDefaults}
                  onChange={e => handleToggleDefault(court.id, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-gray-600">StandardnĂ­ oddĂ­lovĂˇ pravidla</span>
                {pendingId === court.id && (
                  <svg className="h-3.5 w-3.5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                )}
              </label>
            </div>

            {/* RozbalenĂ˝ formulĂˇĹ™ vlastnĂ­ch pravidel */}
            {expanded === court.id && !court.useOrgDefaults && (
              <div className="border-t border-gray-100 bg-gray-50 px-6 py-5 rounded-b-xl">
                <CourtRuleForm
                  court={court}
                  onCancel={() => setExpanded(null)}
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
// HlavnĂ­ export
// ---------------------------------------------------------------------------

export default function ReservationSettings({
  courts,
  organizationId: _organizationId,
  orgSettings,
  orgDefaultRules,
}: {
  courts: Court[]
  organizationId: string
  orgSettings: OrgSettings
  orgDefaultRules: RuleValues | null
}) {
  return (
    <div className="space-y-6">
      <OrgSettingsCard orgSettings={orgSettings} orgDefaultRules={orgDefaultRules} />
      <CourtRulesCard courts={courts} orgDefaultRules={orgDefaultRules} />
    </div>
  )
}

