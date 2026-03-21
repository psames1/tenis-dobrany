import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { DeleteArticleButton } from './DeleteArticleButton'

export const metadata: Metadata = { title: 'Admin – Články' }

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; section?: string }>
}) {
  const { error, section: sectionFilter } = await searchParams
  const supabase = await createClient()

  const [{ data: sections }, { data: pages }] = await Promise.all([
    supabase.from('sections').select('id, slug, title').eq('is_active', true).order('menu_order'),
    supabase
      .from('pages')
      .select('id, title, slug, excerpt, is_active, is_members_only, show_in_menu, sort_order, published_at, sections(title, slug)')
      .order('sort_order', { ascending: false })
      .order('published_at', { ascending: false }),
  ])

  const filtered = sectionFilter
    ? (pages ?? []).filter(p => {
        const sec = Array.isArray(p.sections) ? p.sections[0] : p.sections
        return sec && (sec as { slug: string }).slug === sectionFilter
      })
    : (pages ?? [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Články</h2>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} záznamů</p>
        </div>
        <Link
          href="/admin/clanky/novy"
          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          + Nový článek
        </Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      {/* Filtr sekcí */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href="/admin/clanky"
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${!sectionFilter ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Vše
        </Link>
        {(sections ?? []).map(s => (
          <Link
            key={s.id}
            href={`/admin/clanky?section=${s.slug}`}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${sectionFilter === s.slug ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {s.title}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400">Žádné články.</p>
          <Link href="/admin/clanky/novy" className="mt-3 inline-block text-sm text-green-600 font-medium hover:underline">
            Vytvořit první článek →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Název</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Sekce</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Datum</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Stav</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(article => {
                const sec = Array.isArray(article.sections) ? article.sections[0] : article.sections
                return (
                  <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{article.title}</div>
                      {sec && (
                        <code className="text-xs text-gray-400 font-mono">
                          /{(sec as { slug: string }).slug}/{article.slug}
                        </code>
                      )}
                      {article.is_members_only && (
                        <span className="block text-xs text-green-600">🔒 pouze členové</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden md:table-cell">
                      {sec ? (sec as { title: string }).title : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 hidden lg:table-cell">
                      {new Date(article.published_at).toLocaleDateString('cs-CZ')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${article.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {article.is_active ? 'Aktivní' : 'Skrytý'}
                        </span>
                        {article.show_in_menu && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            V menu
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/clanky/${article.id}/upravit`}
                          className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
                        >
                          Upravit
                        </Link>
                        <DeleteArticleButton id={article.id} title={article.title} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
