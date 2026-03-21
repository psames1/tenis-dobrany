import { createClient } from '@/lib/supabase/server'
import { savePageComponent, saveFooterItem, saveSiteSetting, createPageComponent, deletePageComponent } from '../actions'
import Link from 'next/link'
import type { Metadata } from 'next'
import { DesignContentEditor } from './DesignContentEditor'

export const metadata: Metadata = { title: 'Admin – Design' }

// Popisy komponent pro uživatele
const componentDescriptions: Record<string, string> = {
  header: '🏠 Hlavička – text vlevo nahoře v navigaci (logo text). V poli Nadpis zadejte název webu.',
  hero: '🖼️ Hero – velký úvodní blok s fotkami na pozadí a poloprůhledným oknem. Fotky se střídají jako karusel.',
  text_o_klubu: '📝 O klubu – textový blok pod aktualitami. HTML obsah.',
  parallax_strip: '🌄 Parallax pruh – prosvítající obrázek s efektem při scrollování. Nastavte obrázek v JSON data.',
  text_banner: '🟢 Zelený banner – starší pruh (nahrazeno Hero sekcí).',
  text_image: '🖼️ Text + obrázek – blok s textem a volitelným obrázkem.',
  section_cards: '🗂️ Karty sekcí – mřížka sekcí webu.',
  latest_articles: '📰 Poslední články – blok nejnovějších článků.',
  cta_buttons: '🔘 CTA tlačítka – výzva k akci s tlačítky.',
}

const footerColumnDescriptions: Record<string, string> = {
  paticka_kontakt: '📍 Kontakt – adresa, telefon, e-mail. Zobrazuje se v levém sloupci patičky.',
  paticka_odkazy: '🔗 Odkazy – rychlé navigační odkazy v prostředním sloupci patičky.',
  paticka_dobrany: '🏠 O Dobřanech – informace o klubu v pravém sloupci patičky.',
  social: '📱 Sociální sítě – deaktivováno.',
}

const settingDescriptions: Record<string, string> = {
  site_name: 'Název webu zobrazený v titulku stránek a metadatech',
  contact_email: 'Kontaktní e-mail (zobrazí se na stránce Kontakt)',
  contact_phone: 'Kontaktní telefon',
  contact_address: 'Adresa tenisového areálu',
}

// Vizuální rozvržení domovské stránky
const LAYOUT_ORDER = [
  { component: 'hero', label: 'Hero (fotky + overlay)', icon: '🖼️' },
  { component: '__aktuality__', label: 'Aktuality (automaticky)', icon: '📰' },
  { component: 'text_o_klubu', label: 'O klubu (text)', icon: '📝' },
  { component: 'parallax_strip', label: 'Parallax pruh', icon: '🌄' },
  { component: '__uvod_articles__', label: 'Bloky ze sekce Úvod', icon: '📄' },
]

type Tab = 'layout' | 'components' | 'footer' | 'settings' | 'help'

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; success?: string; error?: string }>
}) {
  const { tab: rawTab, success, error } = await searchParams
  const tab: Tab = (['layout', 'components', 'footer', 'settings', 'help'].includes(rawTab ?? '') ? rawTab : 'layout') as Tab

  const supabase = await createClient()

  const [{ data: pageComponents }, { data: footerItems }, { data: siteSettings }] = await Promise.all([
    supabase
      .from('page_components')
      .select('id, page_key, component, title, subtitle, content, data, sort_order, is_active')
      .order('page_key')
      .order('sort_order'),
    supabase
      .from('footer_content')
      .select('id, column_key, item_type, label, content, data, sort_order, is_active')
      .order('column_key')
      .order('sort_order'),
    supabase
      .from('site_settings')
      .select('key, value')
      .order('key'),
  ])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'layout', label: 'Rozvržení' },
    { key: 'components', label: 'Komponenty' },
    { key: 'footer', label: 'Patička' },
    { key: 'settings', label: 'Nastavení' },
    { key: 'help', label: 'Nápověda' },
  ]

  const homeComponents = (pageComponents ?? []).filter(c => c.page_key === 'home')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Design & nastavení</h2>
        <p className="text-gray-500 text-sm mt-1">Správa komponent úvodní stránky, patičky a globálních nastavení webu.</p>
      </div>

      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Uloženo.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      {/* Záložky */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/admin/design?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-white border border-b-white border-gray-200 text-green-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Záložka: Rozvržení (vizuální přehled) ──────────────────── */}
      {tab === 'layout' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">
            Přehledové rozvržení úvodní stránky shora dolů. Zeleně = aktivní, šedě = neaktivní.
            Pro editaci detailů přejděte na záložku <strong>Komponenty</strong>.
          </p>

          <div className="max-w-2xl mx-auto">
            {/* Hlavička */}
            <div className="border-2 border-green-300 bg-green-50 rounded-t-xl p-4 flex items-center gap-3">
              <span className="text-xl">🏠</span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Hlavička (navigace)</div>
                <div className="text-xs text-gray-500">
                  Logo: {homeComponents.find(c => c.component === 'header')?.title || 'TJ Dobřany'} — vždy zobrazena
                </div>
              </div>
            </div>

            {/* Bloky stránky */}
            {LAYOUT_ORDER.map(item => {
              const pc = homeComponents.find(c => c.component === item.component)
              const isSpecial = item.component.startsWith('__')
              const isActive = isSpecial || pc?.is_active

              return (
                <div
                  key={item.component}
                  className={`border-x-2 border-b-2 p-4 flex items-center justify-between ${
                    isActive
                      ? 'border-green-300 bg-green-50/50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{item.label}</div>
                      <div className="text-xs text-gray-500">
                        {isSpecial
                          ? 'Automaticky generováno z článků'
                          : pc
                            ? `sort: ${pc.sort_order} | ${pc.is_active ? '✅ aktivní' : '❌ neaktivní'}`
                            : '⚠️ Neexistuje v DB – přidejte v záložce Komponenty'
                        }
                      </div>
                    </div>
                  </div>
                  {!isSpecial && pc && (
                    <Link
                      href="/admin/design?tab=components"
                      className="text-xs text-green-600 hover:text-green-800 font-medium"
                    >
                      Upravit →
                    </Link>
                  )}
                </div>
              )
            })}

            {/* Patička */}
            <div className="border-x-2 border-b-2 border-green-300 bg-green-50 rounded-b-xl p-4 flex items-center gap-3">
              <span className="text-xl">🦶</span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Patička</div>
                <div className="text-xs text-gray-500">3 sloupce — upravit v záložce Patička</div>
              </div>
              <Link
                href="/admin/design?tab=footer"
                className="ml-auto text-xs text-green-600 hover:text-green-800 font-medium"
              >
                Upravit →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Záložka: Komponenty úvodní stránky ─────────────────────── */}
      {tab === 'components' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-2">
            Komponenty sestavující úvodní stránku. Každá má nadpis, obsah a volitelná JSON data.
            Pořadí určuje <code className="text-xs bg-gray-100 px-1 rounded">sort_order</code> (nižší = výše).
          </p>

          {/* Formulář pro přidání nové komponenty */}
          <details className="bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
            <summary className="flex items-center gap-2 px-5 py-3 cursor-pointer select-none list-none text-sm font-medium text-blue-700">
              <span className="text-lg">➕</span> Přidat novou komponentu
            </summary>
            <div className="border-t border-blue-200 px-5 py-4">
              <form action={createPageComponent} className="flex flex-wrap gap-3 items-end">
                <input type="hidden" name="page_key" value="home" />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Typ komponenty</label>
                  <select name="component" required className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">— Vyberte —</option>
                    <option value="header">header (Hlavička)</option>
                    <option value="hero">hero (Hero banner)</option>
                    <option value="text_o_klubu">text_o_klubu (O klubu)</option>
                    <option value="parallax_strip">parallax_strip (Parallax pruh)</option>
                    <option value="text_banner">text_banner (Zelený banner)</option>
                    <option value="text_image">text_image (Text + obrázek)</option>
                    <option value="cta_buttons">cta_buttons (CTA tlačítka)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nadpis (volitelný)</label>
                  <input name="title" type="text" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                  Přidat
                </button>
              </form>
            </div>
          </details>
          {(pageComponents ?? []).map(pc => (
            <details key={pc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm group">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${pc.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-900">{pc.component}</span>
                  <span className="text-xs text-gray-400">({pc.page_key})</span>
                  {pc.title && <span className="text-xs text-gray-500 truncate max-w-xs">— {pc.title}</span>}
                </div>
                <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="border-t border-gray-100 px-5 py-4">
                <p className="text-xs text-gray-400 mb-3">
                  {componentDescriptions[pc.component] ?? 'Designová komponenta.'}
                </p>
                <form action={savePageComponent} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="hidden" name="id" value={pc.id} />

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nadpis</label>
                    <input name="title" type="text" defaultValue={pc.title ?? ''}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Podnadpis</label>
                    <input name="subtitle" type="text" defaultValue={pc.subtitle ?? ''}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Obsah (HTML)</label>
                    <DesignContentEditor
                      componentId={pc.id}
                      defaultValue={pc.content ?? ''}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Data (JSON)</label>
                    <textarea name="data_json" rows={3}
                      defaultValue={pc.data ? JSON.stringify(pc.data, null, 2) : '{}'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono" />
                    {pc.component === 'hero' && (
                      <p className="text-xs text-gray-400 mt-1">
                        Hero JSON: {`{"buttons": [{"label": "...", "url": "...", "variant": "primary|outline"}], "images": ["/images/hero/areaal_0.jpg", ...]}`}
                      </p>
                    )}
                    {pc.component === 'parallax_strip' && (
                      <p className="text-xs text-gray-400 mt-1">
                        Parallax JSON: {`{"image_url": "/images/hero/areaal_o1.jpg"}`}
                      </p>
                    )}
                    {pc.component === 'text_banner' && (
                      <p className="text-xs text-gray-400 mt-1">
                        Banner JSON: {`{"buttons": [{"label": "Text", "url": "/url", "variant": "primary|outline"}]}`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1 w-20">Pořadí</label>
                    <input name="sort_order" type="number" defaultValue={pc.sort_order}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="is_active" value="1" defaultChecked={pc.is_active} className="w-4 h-4 accent-green-600" />
                      <span className="text-sm text-gray-700">Aktivní</span>
                    </label>
                  </div>

                  <div className="sm:col-span-2 flex gap-2">
                    <button type="submit"
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
                      Uložit komponentu
                    </button>
                  </div>
                </form>

                {/* Tlačítko smazat */}
                <form action={deletePageComponent} className="mt-3 pt-3 border-t border-gray-100">
                  <input type="hidden" name="id" value={pc.id} />
                  <button type="submit"
                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                    🗑️ Smazat komponentu
                  </button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* ── Záložka: Patička ───────────────────────────────────────── */}
      {tab === 'footer' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Položky patičky webu. Seskupeno podle sloupců. Typ položky určuje formát zobrazení (heading, text, email, phone, address, links_list).
          </p>
          {(footerItems ?? []).map(fi => (
            <details key={fi.id} className="bg-white rounded-xl border border-gray-100 shadow-sm group">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${fi.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-900">{fi.column_key}</span>
                  <span className="text-xs text-gray-400">({fi.item_type})</span>
                  {fi.content && <span className="text-xs text-gray-500 truncate max-w-xs">— {fi.content}</span>}
                </div>
                <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="border-t border-gray-100 px-5 py-4">
                <p className="text-xs text-gray-400 mb-3">
                  {footerColumnDescriptions[fi.column_key] ?? `Sloupec: ${fi.column_key}, typ: ${fi.item_type}`}
                </p>
                <form action={saveFooterItem} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="hidden" name="id" value={fi.id} />

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Obsah {fi.item_type === 'address' || fi.item_type === 'links_list' ? '(nepoužívá se — data jsou v JSON)' : ''}
                    </label>
                    <input name="content" type="text" defaultValue={fi.content ?? ''}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>

                  {(fi.item_type === 'address' || fi.item_type === 'links_list' || fi.item_type === 'social_links') && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Data (JSON)</label>
                      <textarea name="data_json" rows={4}
                        defaultValue={fi.data ? JSON.stringify(fi.data, null, 2) : '{}'}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono" />
                      <p className="text-xs text-gray-400 mt-1">
                        {fi.item_type === 'address' && 'Formát: {"street": "...", "city": "...", "postal": "..."}'}
                        {fi.item_type === 'links_list' && 'Formát: [{"label": "...", "url": "/..."}]'}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="is_active" value="1" defaultChecked={fi.is_active} className="w-4 h-4 accent-green-600" />
                      <span className="text-sm text-gray-700">Aktivní</span>
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <button type="submit"
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
                      Uložit
                    </button>
                  </div>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* ── Záložka: Nastavení ─────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Globální nastavení webu — klíče a jejich hodnoty.
          </p>
          {(siteSettings ?? []).map(s => (
            <form key={s.key} action={saveSiteSetting}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row items-start gap-3"
            >
              <input type="hidden" name="key" value={s.key} />
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 font-mono">{s.key}</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{settingDescriptions[s.key] ?? ''}</p>
                <input name="value" type="text" defaultValue={s.value}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <button type="submit"
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap mt-auto">
                Uložit
              </button>
            </form>
          ))}
        </div>
      )}

      {/* ── Záložka: Nápověda ──────────────────────────────────────── */}
      {tab === 'help' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-3xl">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Jak funguje správa designu</h3>

          <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">📐 Rozvržení úvodní stránky</h4>
              <p>
                Záložka <strong>Rozvržení</strong> zobrazuje vizuální přehled bloků stránky shora dolů.
              </p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li><strong>header</strong> — Text loga v navigaci (pole Nadpis). Pokud neexistuje, zobrazí se „TJ Dobřany".</li>
                <li><strong>hero</strong> — Velký banner s fotkami na pozadí, poloprůhledným oknem, nadpisem, podnadpisem a tlačítky. Fotky v JSON: <code className="bg-gray-100 px-1 rounded text-xs">{`{"images": [...], "buttons": [...]}`}</code></li>
                <li><strong>text_o_klubu</strong> — Text „O klubu" pod aktualitami. HTML obsah.</li>
                <li><strong>parallax_strip</strong> — Prosvítající obrázek s parallax efektem. JSON: <code className="bg-gray-100 px-1 rounded text-xs">{`{"image_url": "/images/hero/areaal_o1.jpg"}`}</code></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-1">📰 Aktuality</h4>
              <p>3 nejnovější články s příznakem „Aktualita". Generují se automaticky.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-1">📝 Sekce „Úvod"</h4>
              <p>
                Články ze sekce <strong>Úvod</strong> (slug: <code className="bg-gray-100 px-1 rounded text-xs">uvod</code>)
                s „Zobrazit v menu" se zobrazí pod parallax pruhem (např. kontakt-mapa).
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-1">🦶 Patička</h4>
              <p>3 sloupce: <strong>paticka_kontakt</strong>, <strong>paticka_odkazy</strong>, <strong>paticka_dobrany</strong>.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-1">⚙️ Nastavení</h4>
              <p>Klíčové hodnoty jako název webu, kontaktní e-mail a telefon.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
