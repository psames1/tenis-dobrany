import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { changeUserRole, toggleUserActive, inviteUser, cancelInvitation } from './actions'
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

  const { data: myProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!myProfile || myProfile.role !== 'admin') redirect('/?error=forbidden')

  // Načti profily uživatelů (vč. phone)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, phone, role, is_active, created_at')
    .order('created_at', { ascending: false })

  // Načti status potvrzení emailu z Supabase Admin API
  type AuthInfo = { is_confirmed: boolean; last_sign_in: string | null }
  const confirmedMap = new Map<string, AuthInfo>()
  let hasAdminClient = false
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
    hasAdminClient = true
    for (const u of data?.users ?? []) {
      confirmedMap.set(u.id, {
        is_confirmed: !!u.email_confirmed_at,
        last_sign_in: u.last_sign_in_at ?? null,
      })
    }
  } catch {
    // Admin client není nastaven — omezené funkce
  }

  const { success, error } = await searchParams

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Uživatelé</h2>
        <span className="text-sm text-gray-500">{profiles?.length ?? 0} účtů</span>
      </div>

      {/* Zprávy */}
      {success === 'invited' && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Pozvánka byla odeslána.
        </div>
      )}
      {success === 'invitation_cancelled' && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Pozvánka byla zrušena a účet smazán.
        </div>
      )}
      {success === 'role_changed' && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Role uživatele byla změněna.
        </div>
      )}
      {success === 'status_changed' && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Stav účtu byl změněn.
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
          Uživatel dostane email s odkazem pro nastavení hesla. Roli lze změnit ihned v tabulce níže.
          {!hasAdminClient && (
            <span className="ml-1 text-amber-600 font-medium">
              SUPABASE_SERVICE_ROLE_KEY není nastaven — stav aktivace a zrušení pozvánky nejsou dostupné.
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-amber-700">
          ⚠ Pro zakázání vlastní registrace: Supabase Dashboard → Authentication → Providers → Email → zrušte zaškrtnutí „Enable email signups".
        </p>
      </div>

      {/* Tabulka uživatelů */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Uživatel</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Telefon</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Stav</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Aktivita</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map(u => {
              const authInfo = confirmedMap.get(u.id)
              // Pokud hasAdminClient: is_confirmed = skutečný stav; pokud ne: předpokládej potvrzeno
              const isPending = hasAdminClient ? (authInfo ? !authInfo.is_confirmed : true) : false
              const lastSignIn = authInfo?.last_sign_in ?? null
              const displayName = u.full_name?.trim() || null

              return (
                <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors${isPending ? ' opacity-75' : ''}`}>
                  {/* Jméno + email */}
                  <td className="px-4 py-3">
                    {displayName ? (
                      <div className="font-medium text-gray-900">{displayName}</div>
                    ) : (
                      <div className="text-gray-400 italic text-xs">Jméno nezadáno</div>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
                  </td>

                  {/* Telefon */}
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                    {u.phone?.trim() || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Role — dropdown (pro všechny vč. neaktivovaných, kromě vlastního účtu) */}
                  <td className="px-4 py-3">
                    {u.id === user.id ? (
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

                  {/* Stav — třestavový: Čeká / Aktivní / Blokovaný */}
                  <td className="px-4 py-3">
                    {isPending ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Čeká na aktivaci
                      </span>
                    ) : (
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
                          title={u.id === user.id ? 'Vlastní účet' : u.is_active ? 'Kliknout pro deaktivaci' : 'Kliknout pro aktivaci'}
                        >
                          {u.is_active ? 'Aktivní' : 'Blokovaný'}
                        </button>
                      </form>
                    )}
                  </td>

                  {/* Poslední přihlášení / datum pozvání */}
                  <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                    {lastSignIn ? (
                      <span title="Poslední přihlášení">
                        {new Date(lastSignIn).toLocaleDateString('cs-CZ')}
                      </span>
                    ) : (
                      <span title="Datum pozvání">
                        {new Date(u.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    )}
                  </td>

                  {/* Akce — Zrušit pozvánku (jen pending, jen s admin clientem) */}
                  <td className="px-4 py-3">
                    {isPending && hasAdminClient && u.id !== user.id && (
                      <form action={cancelInvitation}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          title="Zrušit pozvánku a smazat účet"
                        >
                          Zrušit
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {(profiles ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
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
