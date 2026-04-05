import { createClient } from '@/lib/supabase/server'
import { saveSection, createSection, deleteSection, saveSectionGroupPermissions } from '../actions'
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

  const [{ data: sections }, { data: groups }, { data: allPerms }] = await Promise.all([
    supabase
      .from('sections')
      .select('id, slug, title, menu_title, description, menu_order, show_in_menu, is_active, menu_parent_id, visibility')
      .order('menu_order'),
    supabase
      .from('user_groups')
      .select('id, name')
      .order('name'),
    supabase
      .from('section_group_permissions')
      .select('group_id, section_id, can_create_articles, can_edit_articles, can_delete_articles, can_create_subsections'),
  ])

  const allSections = sections ?? []
  const allGroups   = groups   ?? []
  const permsRows   = allPerms ?? []

  // Permissions indexed by section_id
  const permsBySection = new Map<string, typeof permsRows>()
  for (const p of permsRows) {
    if (!permsBySection.has(p.section_id)) permsBySection.set(p.section_id, [])
    permsBySection.get(p.section_id)!.push(p)
  }

  // Rozdělení na top-level a podsekce
  const topLevel = allSections.filter(s => !s.menu_parent_id)
  const subsectionsByParent = new Map<string, typeof allSections>()
  for (const s of allSections) {
    if (!s.menu_parent_id) continue
    if (!subsectionsByParent.has(s.menu_parent_id)) subsectionsByParent.set(s.menu_parent_id, [])
    subsectionsByParent.get(s.menu_parent_id)!.push(s)
  }

  const parentOptions = topLevel

  function SectionForm({ section }: { section: typeof allSections[0] }) {
    const parentId     = section.menu_parent_id ?? ''
    const sectionPerms = permsBySection.get(section.id) ?? []
    const unassignedGroups = allGroups.filter(g => !sectionPerms.find(p => p.group_id === g.id))

    return (
      <div className="border-t border-gray-100">
        {/* Nastavení sekce */}
        <div className="px-5 py-4">
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
                <option value="">– Hlavní sekce (bez rodiče) –</option>
                {parentOptions.filter(p => p.id !== section.id).map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-400">Podsekce se v menu zobrazují jako položky podmenu nadřazené sekce.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Viditelnost sekce</label>
              <select name="visibility" defaultValue={section.visibility ?? 'public'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option value="public">Veřejná — vidí všichni</option>
                <option value="member">Přihlášení členové</option>
                <option value="editor">Manager a administrátor</option>
                <option value="admin">Pouze administrátor</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-400">Určuje, kdo může sekci vidět v menu a navštívit.</p>
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

        {/* Správci sekce — skupiny */}
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Správci sekce (skupiny)</h4>

          {sectionPerms.length === 0 && allGroups.length === 0 && (
            <p className="text-xs text-gray-400">
              Nejsou žádné skupiny.{' '}
              <a href="/admin/skupiny" className="text-green-600 hover:underline">Vytvořte skupinu</a> nejdřív.
            </p>
          )}

          {/* Stávající skupiny s oprávněními */}
          {sectionPerms.length > 0 && (
            <div className="space-y-3 mb-4">
              {sectionPerms.map(sp => {
                const grp = allGroups.find(g => g.id === sp.group_id)
                if (!grp) return null
                return (
                  <form key={sp.group_id} action={saveSectionGroupPermissions}
                    className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                    <input type="hidden" name="group_id"   value={sp.group_id} />
                    <input type="hidden" name="section_id" value={section.id} />
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">{grp.name}</span>
                      <button type="submit"
                        className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors">
                        Uložit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { name: 'can_create_articles',    label: 'Přidávat články',   val: sp.can_create_articles    },
                        { name: 'can_edit_articles',      label: 'Editovat články',   val: sp.can_edit_articles      },
                        { name: 'can_delete_articles',    label: 'Mazat články',      val: sp.can_delete_articles    },
                        { name: 'can_create_subsections', label: 'Tvořit podsekce', val: sp.can_create_subsections },
                      ] as const).map(opt => (
                        <label key={opt.name} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="checkbox" name={opt.name} value="1"
                            defaultChecked={opt.val} className="w-3.5 h-3.5 accent-green-600" />
                          <span className="text-xs text-gray-600">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </form>
                )
              })}
            </div>
          )}

          {/* Přidat novou skupinu */}
          {unassignedGroups.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-green-700 hover:text-green-800 list-none flex items-center gap-1.5 select-none">
                <span className="group-open:rotate-90 inline-block transition-transform text-[10px]">▶</span>
                Přidat skupinu ke správě sekce
              </summary>
              <form action={saveSectionGroupPermissions} className="mt-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
                <input type="hidden" name="section_id" value={section.id} />
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Skupina</label>
                  <select name="group_id"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">– Vybrat skupinu –</option>
                    {unassignedGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {([
                    { name: 'can_create_articles',    label: 'Přidávat články'   },
                    { name: 'can_edit_articles',      label: 'Editovat články'   },
                    { name: 'can_delete_articles',    label: 'Mazat články'      },
                    { name: 'can_create_subsections', label: 'Tvořit podsekce' },
                  ] as const).map(opt => (
                    <label key={opt.name} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" name={opt.name} value="1" className="w-3.5 h-3.5 accent-green-600" />
                      <span className="text-xs text-gray-600">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <button type="submit"
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">
                  + Přidat skupinu
                </button>
              </form>
            </details>
          )}

          {allGroups.length > 0 && (
            <p className="mt-3 text-[11px] text-gray-400">
              Skupiny spravujte na stránce{' '}
              <a href="/admin/skupiny" className="text-green-600 hover:underline">Admin → Skupiny</a>.
            </p>
          )}
        </div>
      </div>
    )
  }

  function SectionCard({ section, indent = false }: { section: typeof allSections[0]; indent?: boolean }) {
    const sectionPerms = permsBySection.get(section.id) ?? []
    return (
      <details
        className={`bg-white rounded-xl border shadow-sm group ${indent ? 'border-green-100 ml-6' : 'border-gray-100'}`}
      >
        <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {indent && <span className="text-gray-300 text-xs shrink-0">↳</span>}
            <span className={`w-2 h-2 rounded-full shrink-0 ${section.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
            <span className="font-medium text-gray-900 truncate">{section.title}</span>
            <span className="text-xs text-gray-400 shrink-0">/{section.slug}</span>
            {section.show_in_menu && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">v menu</span>
            )}
            {indent && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">podsekce</span>
            )}
            {sectionPerms.length > 0 && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full shrink-0">
                {sectionPerms.length === 1 ? '1 skupina' : `${sectionPerms.length} skupiny`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sekce webu</h2>
        <p className="text-gray-500 text-sm mt-1">Správa navigačních sekcí, jejich nastavení a správcovských skupin.</p>
      </div>

      {/* Formulář pro novou sekci */}
      <form action={createSection} className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Nová sekce</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Název *</label>
            <input name="title" type="text" required placeholder="Název sekce…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nadřazená sekce</label>
            <select name="parent_id"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="">– Hlavní sekce –</option>
              {parentOptions.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" name="show_in_menu" value="1" className="w-4 h-4 accent-green-600" />
            <span className="text-sm text-gray-700">Zobrazit v menu</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" name="is_active" value="1" defaultChecked className="w-4 h-4 accent-green-600" />
            <span className="text-sm text-gray-700">Aktivní</span>
          </label>
        </div>
        <button type="submit"
          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
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

      <div className="space-y-4">
        {topLevel.map(section => (
          <div key={section.id} className="space-y-2">
            <SectionCard section={section} />
            {(subsectionsByParent.get(section.id) ?? []).map(sub => (
              <SectionCard key={sub.id} section={sub} indent />
            ))}
          </div>
        ))}
        {allSections
          .filter(s => s.menu_parent_id && !topLevel.find(t => t.id === s.menu_parent_id))
          .map(s => <SectionCard key={s.id} section={s} indent />)}
      </div>
    </div>
  )
}
