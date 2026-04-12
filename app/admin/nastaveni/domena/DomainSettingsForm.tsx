'use client'

import { useState } from 'react'
import { saveCustomDomain } from './actions'

type Props = {
  orgId: string
  orgName: string
  orgSlug: string
  currentDomain: string | null
}

export default function DomainSettingsForm({ orgId, orgName, orgSlug, currentDomain }: Props) {
  const [domain, setDomain] = useState(currentDomain ?? '')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

  const defaultSubdomain = `${orgSlug}.sportkalendar.cz`
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setResult(null)

    const res = await saveCustomDomain(orgId, cleanDomain || null)
    setResult(res)
    setSaving(false)
  }

  return (
    <div className="space-y-8">
      {/* Aktuální stav */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Aktuální doména</h2>
        <p className="text-sm text-gray-500 mb-4">
          Vaše organizace <strong>{orgName}</strong> je dostupná na výchozí adrese:
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Subdoména</span>
            <a href={`https://${defaultSubdomain}`} target="_blank" rel="noopener noreferrer"
              className="text-green-600 font-mono text-xs hover:underline">
              {defaultSubdomain}
            </a>
          </div>
          {currentDomain && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
              <span className="text-gray-500">Vlastní doména</span>
              <a href={`https://${currentDomain}`} target="_blank" rel="noopener noreferrer"
                className="text-green-600 font-mono text-xs hover:underline">
                {currentDomain}
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Nastavení vlastní domény */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Nastavení vlastní domény</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pokud chcete, aby byl web vaší organizace dostupný na vlastní doméně
          (např. <span className="font-mono text-xs">www.muj-oddil.cz</span>),
          zadejte ji níže a nastavte DNS záznamy u vašeho registrátora.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vlastní doména</label>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="www.muj-oddil.cz"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
            <p className="mt-1 text-xs text-gray-400">
              Zadejte bez <span className="font-mono">https://</span>. Pro odebrání nechte pole prázdné.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Ukládám…' : 'Uložit doménu'}
            </button>
            {result && (
              <span className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {result.success ? '✓ Uloženo' : `✗ ${result.error}`}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* DNS instrukce */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Nastavení DNS</h2>
        <p className="text-sm text-gray-500 mb-4">
          Po uložení domény nastavte u svého registrátora (např. Wedos, Forpsi, Active24, Cloudflare)
          následující DNS záznamy. Bez nich nebude vlastní doména fungovat.
        </p>

        <div className="space-y-4">
          {/* CNAME pro www */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Varianta A — www subdoména (doporučeno)
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Pokud chcete web na <span className="font-mono">www.vase-domena.cz</span>:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-1 pr-4">Typ</th>
                    <th className="pb-1 pr-4">Název / Host</th>
                    <th className="pb-1 pr-4">Hodnota / Cíl</th>
                    <th className="pb-1">TTL</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-gray-900">
                  <tr>
                    <td className="py-1 pr-4">CNAME</td>
                    <td className="py-1 pr-4">www</td>
                    <td className="py-1 pr-4">cname.vercel-dns.com</td>
                    <td className="py-1">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* A záznam pro apex */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Varianta B — holá doména (apex)
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Pokud chcete web přímo na <span className="font-mono">vase-domena.cz</span> (bez www):
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-1 pr-4">Typ</th>
                    <th className="pb-1 pr-4">Název / Host</th>
                    <th className="pb-1 pr-4">Hodnota / Cíl</th>
                    <th className="pb-1">TTL</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-gray-900">
                  <tr>
                    <td className="py-1 pr-4">A</td>
                    <td className="py-1 pr-4">@</td>
                    <td className="py-1 pr-4">76.76.21.21</td>
                    <td className="py-1">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Oba současně */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">💡 Tip</p>
            <p className="text-xs leading-relaxed">
              Nejlepší je nastavit <strong>oba záznamy současně</strong> — A záznam pro apex a CNAME pro www.
              V Dashboardu Vercel (Settings → Domains) pak přidejte vaši doménu a Vercel automaticky
              zajistí SSL certifikát a přesměrování.
            </p>
          </div>

          {/* Vercel krok */}
          <div className="bg-amber-50 rounded-lg p-4 text-sm text-amber-700">
            <p className="font-medium mb-1">⚠️ Nutný krok na Vercelu</p>
            <p className="text-xs leading-relaxed">
              Samotné DNS záznamy nestačí. Je třeba doménu přidat i v <strong>Vercel Dashboard</strong>:
              <br />
              Project → Settings → Domains → Add → zadejte vaši doménu.
              <br />
              Vercel ji ověří a automaticky vystaví SSL certifikát (Let&#39;s Encrypt).
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
