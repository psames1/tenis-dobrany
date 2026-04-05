import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createGroup, deleteGroup } from './actions'

export const metadata: Metadata = { title: 'Admin – Skupiny uživatelů' }

type SearchParams = Promise<{ success?: string; error?: string }>

export default async function AdminSkupinyPage({ searchParams }: { searchParams: SearchParams }) {
  const { success, error } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/admin?error=forbidden')

  // Skupiny s počtem členů
  const { data: groups } = await supabase
    .from('user_groups')
    .select('id, name, description, created_at, user_group_members(count)')
    .order('name')

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Skupiny uživatelů</h2>
        <p className="text-gray-500 text-sm mt-1">
          Skupiny fungují jako sekční editorské role — přidělují oprávnění spravovat obsah konkrétní sekce.
        </p>
      </div>

      {success === 'created' && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Skupina byla vytvořena.
        </div>
      )}
      {success === 'deleted' && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Skupina byla smazána.
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      {/* Formulář nová skupina */}
      <form action={createGroup} className="mb-8 p-5 bg-white rounded-xl border border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Nová skupina</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Název skupiny *</label>
            <input
              name="name" type="text" required placeholder="Správci brigád…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Popis (volitelný)</label>
            <input
              name="description" type="text" placeholder="Krátký popis skupiny…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          + Vytvořit skupinu
        </button>
      </form>

      {/* Seznam skupin */}
      <div className="space-y-3">
        {(groups ?? []).length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl text-gray-400 text-sm">
            Žádné skupiny. Vytvořte první skupinu nahoře.
          </div>
        ) : (
          (groups ?? []).map(group => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const memberCount = (group as any).user_group_members?.[0]?.count ?? 0
            return (
              <div
                key={group.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 px-5 py-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{group.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                      {memberCount} {memberCount === 1 ? 'člen' : memberCount < 5 ? 'členové' : 'členů'}
                    </span>
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{group.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/skupiny/${group.id}`}
                    className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Spravovat →
                  </Link>
                  <form action={deleteGroup}>
                    <input type="hidden" name="id" value={group.id} />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Smazat
                    </button>
                  </form>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
