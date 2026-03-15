import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin – Přehled' }

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [
    { count: articlesCount },
    { count: sectionsCount },
    { count: usersCount },
    { data: recentArticles },
  ] = await Promise.all([
    supabase.from('pages').select('id', { count: 'exact', head: true }),
    supabase.from('sections').select('id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('pages')
      .select('id, title, published_at, is_active, sections(title, slug)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const stats = [
    { label: 'Článků celkem', value: articlesCount ?? 0, icon: '📝', href: '/admin/clanky' },
    { label: 'Sekcí', value: sectionsCount ?? 0, icon: '🗂️', href: '/admin/sekce' },
    { label: 'Uživatelů', value: usersCount ?? 0, icon: '👥', href: '/admin/uzivatele' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Přehled</h2>
        <p className="text-gray-500 text-sm mt-1">Vítej v administraci TJ Dobřany.</p>
      </div>

      {/* Statistiky */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-green-200 transition-all"
          >
            <span className="text-3xl" aria-hidden="true">{stat.icon}</span>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Rychlé akce */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Rychlé akce
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/clanky/novy"
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            + Nový článek
          </Link>
          <Link
            href="/admin/clanky"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:border-green-300 transition-colors"
          >
            Správa článků
          </Link>
          <Link
            href="/admin/sekce"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:border-green-300 transition-colors"
          >
            Správa sekcí
          </Link>
        </div>
      </div>

      {/* Poslední články */}
      {(recentArticles ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Naposledy přidáno
          </h3>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {(recentArticles ?? []).map((article) => {
              const sec = Array.isArray(article.sections) ? article.sections[0] : article.sections
              return (
                <div key={article.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{article.title}</div>
                    {sec && (
                      <div className="text-xs text-gray-400">{(sec as { title: string }).title}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${article.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {article.is_active ? 'Aktivní' : 'Skrytý'}
                    </span>
                    <Link
                      href={`/admin/clanky/${article.id}/upravit`}
                      className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
                    >
                      Upravit
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
