import Link from 'next/link'

const SECTION_ICONS: Record<string, string> = {
  aktuality: '📰',
  'o-klubu': '🏆',
  turnaje: '🏅',
  'pro-cleny': '👥',
}

type Section = {
  id: string
  slug: string
  title: string
  description: string | null
}

type Props = {
  title?: string | null
  subtitle?: string | null
  sections: Section[]
}

export function SectionCardsBlock({ title, subtitle, sections }: Props) {
  if (!sections.length) return null

  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {(title || subtitle) && (
          <div className="text-center mb-10">
            {title && <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{title}</h2>}
            {subtitle && <p className="text-gray-500">{subtitle}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map(section => (
            <Link
              key={section.id}
              href={`/${section.slug}`}
              className="group block bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all"
            >
              <div className="text-4xl mb-4">{SECTION_ICONS[section.slug] ?? '📄'}</div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 transition-colors mb-2">
                {section.title}
              </h3>
              {section.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{section.description}</p>
              )}
              <span className="inline-flex items-center gap-1 mt-4 text-sm text-green-600 font-medium group-hover:gap-2 transition-all">
                Zobrazit
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
