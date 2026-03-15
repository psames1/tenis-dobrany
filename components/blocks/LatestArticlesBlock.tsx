import Link from 'next/link'

type Article = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  image_url: string | null
  published_at: string
  section: { slug: string } | null
}

type Props = {
  title?: string | null
  articles: Article[]
  sectionSlug: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function LatestArticlesBlock({ title, articles, sectionSlug }: Props) {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          {title && <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>}
          <Link
            href={`/${sectionSlug}`}
            className="text-sm text-green-600 font-medium hover:text-green-800 transition-colors whitespace-nowrap ml-4"
          >
            Všechny aktuality →
          </Link>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl">
            <p className="text-gray-400 text-lg">Zatím žádné aktuality.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map(article => (
              <Link
                key={article.id}
                href={`/${sectionSlug}/${article.slug}`}
                className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all"
              >
                {/* Náhledový obrázek nebo placeholder */}
                <div className="bg-green-50 h-40 flex items-center justify-center text-5xl flex-shrink-0">
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
                <div className="p-5 flex flex-col flex-1">
                  <time className="text-xs text-gray-400 mb-2 block">{formatDate(article.published_at)}</time>
                  <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors leading-snug mb-2">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-sm text-gray-500 line-clamp-3 flex-1">{article.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
