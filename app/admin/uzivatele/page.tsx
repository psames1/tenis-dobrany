import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { changeUserRole, toggleUserActive, inviteUser } from './actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin – Uživatelé' }

const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  manager: 'Editor',
  member:  'Člen',
}

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  member:  'bg-gray-100 text-gray-600',
}

type SearchParams = Promise<{ success?: string; error?: string }>

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()

  // Ověř admin přístup
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/?error=forbidden')

  // Načti všechny uživatele
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, is_active, created_at')
    .order('created_at', { ascending: false })

  const { success, error } = await searchParams

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Uživatelé</h2>
        <span className="text-sm text-gray-500">{users?.length ?? 0} účtů</span>
      </div>

      {/* Zprávy */}
      {success === 'invited' && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Pozvánka byla odeslána.
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      {/* Formulář — pozvat nového uživatele */}
      <div className="mb-8 p-5 bg-white rounded-xl border border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Pozvat nového uživatele</h3>
        <form action={inviteUser} className="flex gap-3">
          <input
            name="email"
            type="email"
            required
            placeholder="email@example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Odeslat pozvánku
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          Uživatel dostane email s odkazem pro nastavení hesla. Po registraci bude mít roli Člen.
        </p>
      </div>

      {/* Tabulka uživatelů */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Uživatel</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Stav</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Registrace</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                {/* Jméno + email */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.full_name ?? '—'}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </td>

                {/* Role — dropdown */}
                <td className="px-4 py-3">
                  {u.id === user.id ? (
                    // Vlastní účet nelze snížit
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  ) : (
                    <form action={changeUserRole} className="flex items-center gap-1">
                      <input type="hidden" name="user_id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="px-2 py-1 border border-gray-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        <option value="member">Člen</option>
                        <option value="manager">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="submit"
                        className="px-2 py-1 text-xs text-green-700 border border-green-200 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                      >
                        Uložit
                      </button>
                    </form>
                  )}
                </td>

                {/* Stav aktivita */}
                <td className="px-4 py-3">
                  <form action={toggleUserActive} className="inline">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="is_active" value={u.is_active ? '0' : '1'} />
                    <button
                      type="submit"
                      disabled={u.id === user.id}
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium transition-opacity ${
                        u.is_active
                          ? 'bg-green-100 text-green-700 hover:opacity-70'
                          : 'bg-red-100 text-red-700 hover:opacity-70'
                      } disabled:cursor-default disabled:hover:opacity-100`}
                      title={u.id === user.id ? 'Vlastní účet' : u.is_active ? 'Deaktivovat' : 'Aktivovat'}
                    >
                      {u.is_active ? 'Aktivní' : 'Blokovaný'}
                    </button>
                  </form>
                </td>

                {/* Datum */}
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(u.created_at).toLocaleDateString('cs-CZ')}
                </td>

                {/* Placeholder pro budoucí akce */}
                <td className="px-4 py-3" />
              </tr>
            ))}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Žádní uživatelé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
