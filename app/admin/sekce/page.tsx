import { createClient } from '@/lib/supabase/server'
import { saveSection } from '../actions'
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
    .select('id, slug, title, menu_title, description, menu_order, show_in_menu, is_active')
    .order('menu_order')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sekce webu</h2>
        <p className="text-gray-500 text-sm mt-1">Správa navigačních sekcí a jejich nastavení.</p>
      </div>

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

      <div className="space-y-4">
        {(sections ?? []).map(section => (
          <details
            key={section.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm group"
          >
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${section.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                <span className="font-medium text-gray-900">{section.title}</span>
                <span className="text-xs text-gray-400">/{section.slug}</span>
                {section.show_in_menu && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">v menu</span>
                )}
              </div>
              <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

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

                <div className="sm:col-span-2">
                  <button type="submit"
                    className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
                    Uložit sekci
                  </button>
                </div>
              </form>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
