import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: sectionSlug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('sections')
    .select('title, description')
    .eq('slug', sectionSlug)
    .eq('is_active', true)
    .single()
  if (!data) return {}
  return {
    title: data.title,
    description: data.description ?? undefined,
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function SectionPage({ params }: Props) {
  const { section: sectionSlug } = await params
  const supabase = await createClient()

  const [{ data: section }, { data: { user } }] = await Promise.all([
    supabase
      .from('sections')
      .select('id, slug, title, description')
      .eq('slug', sectionSlug)
      .eq('is_active', true)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!section) notFound()

  const { data: pages } = await supabase
    .from('pages')
    .select('id, slug, title, excerpt, image_url, published_at, is_members_only')
    .eq('section_id', section.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('published_at', { ascending: false })

  const articles = pages ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-green-600 transition-colors">Domů</Link>
        <span>/</span>
        <span className="text-gray-700">{section.title}</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{section.title}</h1>
      {section.description && (
        <p className="text-gray-500 mb-10">{section.description}</p>
      )}

      {articles.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 rounded-2xl">
          <p className="text-5xl mb-4">📄</p>
          <p className="text-gray-500 text-lg">Zatím zde nejsou žádné příspěvky.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {articles.map(article => (
            <article
              key={article.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-green-200 transition-all"
            >
              <Link href={`/${sectionSlug}/${article.slug}`} className="flex flex-col sm:flex-row group">
                {/* Náhled obrázku / placeholder */}
                <div className="sm:w-44 h-40 sm:h-auto bg-green-50 flex items-center justify-center text-5xl flex-shrink-0">
                  {article.image_url ? (
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    '📰'
                  )}
                </div>

                {/* Text */}
                <div className="p-5 flex flex-col justify-center flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <time className="text-xs text-gray-400">{formatDate(article.published_at)}</time>
                    {article.is_members_only && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Pouze pro členy
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 transition-colors leading-snug mb-2">
                    {article.title}
                  </h2>
                  {article.excerpt && (
                    <p className="text-sm text-gray-500 line-clamp-2">{article.excerpt}</p>
                  )}
                  <span className="mt-3 text-sm text-green-600 font-medium">
                    Číst více →
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
