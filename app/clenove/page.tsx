import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Členská sekce – Přehled' }

export default async function MemberDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // Články, ke kterým je přihlášený uživatel spoluautorem
  const { data: contributions } = await supabase
    .from('article_contributors')
    .select('page_id, pages(id, title, slug, is_active, published_at, sections(title, slug))')
    .eq('user_id', user.id)
    .order('invited_at', { ascending: false })

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? 'Ahoj'

  return (
    <div className="space-y-8">
      {/* Uvítání */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Ahoj, {displayName.split(' ')[0]}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Vítejte v členské sekci TJ Dobřany.
        </p>
      </div>

      {/* Moje příspěvky */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Moje příspěvky</h2>

        {(!contributions || contributions.length === 0) ? (
          <div className="py-10 text-center bg-white rounded-xl border border-gray-200">
            <p className="text-sm text-gray-400">
              Zatím nejste přiřazen k žádnému článku jako spoluautor.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {contributions.map(c => {
              const page = (c.pages as unknown) as { id: string; title: string; slug: string; is_active: boolean; published_at: string; sections: { title: string; slug: string } | null } | null
              if (!page) return null
              return (
                <div key={c.page_id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{page.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {page.sections?.title ?? '—'} ·{' '}
                      {new Date(page.published_at).toLocaleDateString('cs-CZ')}
                      {!page.is_active && (
                        <span className="ml-2 text-amber-600 font-medium">Skrytý</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/clenove/clanky/${page.id}/upravit`}
                    className="ml-4 shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Pencil size={13} />
                    Upravit
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Rychlé odkazy */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Rychlé odkazy</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/clenove/profil"
            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-sm transition-all"
          >
            <div className="font-semibold text-gray-900">Upravit profil</div>
            <div className="text-xs text-gray-400 mt-1">Jméno, telefon</div>
          </Link>
          <Link
            href="/clenove/dokumenty"
            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-sm transition-all"
          >
            <div className="font-semibold text-gray-900">Dokumenty</div>
            <div className="text-xs text-gray-400 mt-1">Stanovy, zápisy, formuláře</div>
          </Link>
        </div>
      </section>
    </div>
  )
}
