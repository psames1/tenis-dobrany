import { createClient } from '@/lib/supabase/server'
import { saveSection, createSection, deleteSection } from '../actions'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin – Sekce' }

export default async function AdminSekce({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams
  const supabase = await createClient()

  const { data: sections } = await supabase
    .from('sections')
    .select('id, slug, title, menu_title, description, menu_order, show_in_menu, is_active, menu_parent_id')
    .order('menu_order')

  const allSections = sections ?? []

  // Rozdělení na top-level sekce a podsekce
  const topLevel = allSections.filter(s => !s.menu_parent_id)
  const subsectionsByParent = new Map<string, typeof allSections>()
  for (const s of allSections) {
    if (!s.menu_parent_id) continue
    if (!subsectionsByParent.has(s.menu_parent_id)) subsectionsByParent.set(s.menu_parent_id, [])
    subsectionsByParent.get(s.menu_parent_id)!.push(s)
  }

  // Sekce pro dropdown (jen top-level — nelze vybrat sebe sama ani podsekci jako rodiče podsekce)
  const parentOptions = topLevel

  function SectionForm({ section }: { section: typeof allSections[0] }) {
    const parentId = section.menu_parent_id ?? ''
    return (
      <div className="border-t border-gray-100 px-5 py-4">
        <form action={saveSection} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input type="hidden" name="id" value={section.id} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Název</label>
            <input name="title" type="text" required defaultValue={section.title}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Název v menu (volitelný)</label>
            <input name="menu_title" type="text" defaultValue={section.menu_title ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nadřazená sekce</label>
            <select name="parent_id" defaultValue={parentId}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="">— Hlavní sekce (bez rodiče) —</option>
              {parentOptions
                .filter(p => p.id !== section.id)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">Podsekce se v menu zobrazují jako položky podmenu nadřazené sekce.</p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Popis sekce</label>
            <input name="description" type="text" defaultValue={section.description ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pořadí v menu</label>
            <input name="menu_order" type="number" defaultValue={section.menu_order}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="flex items-center gap-6 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="show_in_menu" value="1"
                defaultChecked={section.show_in_menu} className="w-4 h-4 accent-green-600" />
              <span className="text-sm text-gray-700">Zobrazit v menu</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_active" value="1"
                defaultChecked={section.is_active} className="w-4 h-4 accent-green-600" />
              <span className="text-sm text-gray-700">Aktivní</span>
            </label>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit"
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
              Uložit sekci
            </button>
          </div>
        </form>

        <form action={deleteSection} className="mt-3 pt-3 border-t border-gray-100">
          <input type="hidden" name="id" value={section.id} />
          <button type="submit" className="text-xs text-red-500 hover:text-red-700 transition-colors">
            Smazat sekci
          </button>
        </form>
      </div>
    )
  }

  function SectionCard({ section, indent = false }: { section: typeof allSections[0]; indent?: boolean }) {
    return (
      <details
        className={`bg-white rounded-xl border shadow-sm group ${indent ? 'border-green-100 ml-6' : 'border-gray-100'}`}
      >
        <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
          <div className="flex items-center gap-3">
            {indent && <span className="text-gray-300 text-xs" aria-hidden="true">↳</span>}
            <span className={`w-2 h-2 rounded-full ${section.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
            <span className="font-medium text-gray-900">{section.title}</span>
            <span className="text-xs text-gray-400">/{section.slug}</span>
            {section.show_in_menu && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">v menu</span>
            )}
            {indent && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">podsekce</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/clanky?section=${section.slug}`}
              className="px-2.5 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors"
            >
              Články →
            </Link>
            <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </summary>
        <SectionForm section={section} />
      </details>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sekce webu</h2>
          <p className="text-gray-500 text-sm mt-1">Správa navigačních sekcí a jejich nastavení.</p>
        </div>
      </div>

      {/* Formulář pro novou sekci */}
      <form action={createSection} className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Název nové sekce</label>
          <input
            name="title"
            type="text"
            required
            placeholder="Název nové sekce…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nadřazená sekce (volitelná)</label>
          <select name="parent_id"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
            <option value="">— Hlavní sekce —</option>
            {parentOptions.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="sm:col-span-3 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          + Přidat sekci
        </button>
      </form>

      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Sekce byla uložena.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      {/* Seznam sekcí — top-level se svými podsekcemi */}
      <div className="space-y-4">
        {topLevel.map(section => (
          <div key={section.id} className="space-y-2">
            <SectionCard section={section} />
            {/* Podsekce pod touto sekcí */}
            {(subsectionsByParent.get(section.id) ?? []).map(sub => (
              <SectionCard key={sub.id} section={sub} indent />
            ))}
          </div>
        ))}

        {/* Osiřelé podsekce (parent byl smazán — parent_id existuje ale nedohledatelný) */}
        {allSections
          .filter(s => s.menu_parent_id && !topLevel.find(t => t.id === s.menu_parent_id))
          .map(s => (
            <SectionCard key={s.id} section={s} indent />
          ))}
      </div>
    </div>
  )
}

