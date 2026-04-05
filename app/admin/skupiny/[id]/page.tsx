import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { addGroupMember, removeGroupMember, saveGroupPermissions } from '../actions'

export const metadata: Metadata = { title: 'Admin – Nastavení skupiny' }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Editor', member: 'Člen',
}

export default async function GroupDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { success, error } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: myProfile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (!myProfile || myProfile.role !== 'admin') redirect('/admin?error=forbidden')

  // Načti skupinu
  const { data: group } = await supabase
    .from('user_groups').select('id, name, description').eq('id', id).single()
  if (!group) redirect('/admin/skupiny')

  // Načti členy skupiny s profily
  const { data: members } = await supabase
    .from('user_group_members')
    .select('user_id, user_profiles(id, email, full_name, role)')
    .eq('group_id', id)

  // Všichni aktivní uživatelé (pro přidání)
  const { data: allUsers } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role')
    .eq('is_active', true)
    .order('full_name')

  // Všechny aktivní sekce
  const { data: sections } = await supabase
    .from('sections')
    .select('id, slug, title, menu_parent_id')
    .eq('is_active', true)
    .order('menu_order', { ascending: false })

  // Stávající oprávnění skupiny
  const { data: permissions } = await supabase
    .from('section_group_permissions')
    .select('section_id, can_create_articles, can_edit_articles, can_delete_articles, can_create_subsections')
    .eq('group_id', id)

  const permMap = new Map((permissions ?? []).map(p => [p.section_id, p]))
  const memberIds = new Set((members ?? []).map(m => m.user_id))
  const nonMembers = (allUsers ?? []).filter(u => !memberIds.has(u.id))

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/skupiny" className="text-sm text-gray-400 hover:text-green-600 transition-colors">
          ← Zpět na skupiny
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 mt-2">{group.name}</h2>
        {group.description && (
          <p className="text-gray-500 text-sm mt-1">{group.description}</p>
        )}
      </div>

      {success && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Změny byly uloženy.
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ─ Členové skupiny ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Členové skupiny</h3>

          {/* Stávající členové */}
          <div className="space-y-1 mb-5">
            {(members ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Skupina nemá žádné členy.</p>
            ) : (
              (members ?? []).map(m => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = Array.isArray((m as any).user_profiles) ? (m as any).user_profiles[0] : (m as any).user_profiles
                return (
                  <div key={m.user_id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {p?.full_name || p?.email || '—'}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span className="truncate">{p?.email}</span>
                        {p?.role && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                            {ROLE_LABELS[p.role] ?? p.role}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={removeGroupMember}>
                      <input type="hidden" name="group_id" value={id} />
                      <input type="hidden" name="user_id"  value={m.user_id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0">
                        Odebrat
                      </button>
                    </form>
                  </div>
                )
              })
            )}
          </div>

          {/* Přidat člena */}
          {nonMembers.length > 0 ? (
            <form action={addGroupMember} className="flex gap-2 items-end">
              <input type="hidden" name="group_id" value={id} />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Přidat uživatele</label>
                <select
                  name="user_id"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">— Vybrat uživatele —</option>
                  {nonMembers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({ROLE_LABELS[u.role] ?? u.role})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors shrink-0"
              >
                + Přidat
              </button>
            </form>
          ) : (
            <p className="text-xs text-gray-400">Všichni uživatelé jsou již členy skupiny.</p>
          )}
        </div>

        {/* ─ Oprávnění na sekce ──────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Oprávnění na sekce</h3>
          <p className="text-xs text-gray-400 mb-4">
            Zaškrtněte oprávnění pro každou sekci a klikněte Uložit.
          </p>
          <div className="space-y-5 max-h-[28rem] overflow-y-auto pr-1">
            {(sections ?? []).map(section => {
              const perm = permMap.get(section.id)
              const isSub = !!section.menu_parent_id
              return (
                <form key={section.id} action={saveGroupPermissions} className={isSub ? 'pl-4 border-l-2 border-blue-100' : ''}>
                  <input type="hidden" name="group_id"   value={id} />
                  <input type="hidden" name="section_id" value={section.id} />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isSub && <span className="text-gray-300 text-xs shrink-0">↳</span>}
                      <span className="text-sm font-medium text-gray-800 truncate">{section.title}</span>
                      {isSub && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">podsekce</span>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors shrink-0 ml-2"
                    >
                      Uložit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                    {[
                      { name: 'can_view',               label: 'Zobrazit sekci',     val: (perm as unknown as Record<string,boolean> | undefined)?.can_view ?? false },
                      { name: 'can_create_articles',    label: 'Přidávat články',    val: perm?.can_create_articles    ?? false },
                      { name: 'can_edit_articles',      label: 'Editovat články',    val: perm?.can_edit_articles      ?? false },
                      { name: 'can_delete_articles',    label: 'Mazat články',       val: perm?.can_delete_articles    ?? false },
                      { name: 'can_create_subsections', label: 'Přidávat podsekce', val: perm?.can_create_subsections ?? false },
                    ].map(opt => (
                      <label key={opt.name} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox" name={opt.name} value="1"
                          defaultChecked={opt.val}
                          className="w-3.5 h-3.5 accent-green-600"
                        />
                        <span className="text-xs text-gray-600">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </form>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
