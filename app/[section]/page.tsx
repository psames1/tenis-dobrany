import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { visibilitiesForRole } from '@/lib/supabase/visibility'

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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
}

function excerptFallback(excerpt: string | null, content: string | null, maxChars = 150): string | null {
  if (excerpt?.trim()) return excerpt.trim()
  if (!content) return null
  const plain = stripHtml(content)
  return plain.length > maxChars ? plain.slice(0, maxChars) + '…' : plain || null
}

export default async function SectionPage({ params }: Props) {
  const { section: sectionSlug } = await params
  const supabase = await createClient()

  const [{ data: section }, { data: { user } }] = await Promise.all([
    supabase
      .from('sections')
      .select('id, slug, title, description, menu_parent_id')
      .eq('slug', sectionSlug)
      .eq('is_active', true)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!section) notFound()

  // Načíst nadřazenou sekci pro breadcrumbs (pokud existuje)
  let parentSection: { slug: string; title: string } | null = null
  if (section.menu_parent_id) {
    const { data: parent } = await supabase
      .from('sections')
      .select('slug, title')
      .eq('id', section.menu_parent_id)
      .single()
    parentSection = parent ?? null
  }

  // Fetch subsections (only for top-level sections — subsection slug + title for badge)
  let subsections: { id: string; slug: string; title: string }[] = []
  if (!section.menu_parent_id) {
    const { data: subs } = await supabase
      .from('sections')
      .select('id, slug, title')
      .eq('menu_parent_id', section.id)
      .eq('is_active', true)
    subsections = subs ?? []
  }
  const subsectionMap = new Map(subsections.map(s => [s.id, s]))

  // Zjisti roli uživatele → filtrování viditelnosti článků
  let role: string | null = null
  if (user) {
    const { data: up } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    if (up?.is_active) role = up.role ?? 'member'
  }
  const visibilities = visibilitiesForRole(role)

  // Zjisti oprávnění na sekci (pro sekční editory)
  let canCreateArticles = false
  if (role === 'admin' || role === 'manager') {
    canCreateArticles = true
  } else if (user) {
    const { data: memberships } = await supabase
      .from('user_group_members')
      .select('group_id')
      .eq('user_id', user.id)
    const groupIds = (memberships ?? []).map(m => m.group_id)
    if (groupIds.length > 0) {
      const { data: perms } = await supabase
        .from('section_group_permissions')
        .select('can_create_articles')
        .eq('section_id', section.id)
        .in('group_id', groupIds)
      canCreateArticles = (perms ?? []).some(p => p.can_create_articles)
    }
  }

  // Sekce "aktuality" zobrazuje i články z jiných sekcí označené is_news=true
  const isAktuality = sectionSlug === 'aktuality'

  const pagesQuery = supabase
    .from('pages')
    .select('id, slug, title, excerpt, content, image_url, updated_at, is_members_only, section_id, sections(id, slug, title)')
    .eq('is_active', true)
    .in('visibility', visibilities)
    .order('updated_at', { ascending: false })

  const subsectionIds = subsections.map(s => s.id)
  if (isAktuality) {
    pagesQuery.or(`section_id.eq.${section.id},is_news.eq.true`)
  } else if (subsectionIds.length > 0) {
    pagesQuery.in('section_id', [section.id, ...subsectionIds])
  } else {
    pagesQuery.eq('section_id', section.id)
  }

  const { data: pages } = await pagesQuery

  const articles = pages ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-green-600 transition-colors">Domů</Link>
        {parentSection && (
          <>
            <span>/</span>
            <Link href={`/${parentSection.slug}`} className="hover:text-green-600 transition-colors">
              {parentSection.title}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-700">{section.title}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-bold text-gray-900">{section.title}</h1>
        {canCreateArticles && (
          <Link
            href={role === 'admin' || role === 'manager'
              ? `/admin/clanky/novy?section=${sectionSlug}`
              : `/clenove/sekce/${sectionSlug}/novy`}
            className="shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            + Nový článek
          </Link>
        )}
      </div>
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
          {articles.map(article => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sec = Array.isArray((article as any).sections) ? (article as any).sections[0] : (article as any).sections
            const articleSection = sec?.slug ?? sectionSlug
            const fromSubsection = article.section_id !== section.id
              ? subsectionMap.get(article.section_id ?? '') ?? null
              : null
            const preview = excerptFallback(article.excerpt, article.content)
            return (
            <article
              key={article.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-green-200 transition-all"
            >
              <Link href={`/${articleSection}/${article.slug}`} className="flex flex-col sm:flex-row group">
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
                    <time className="text-xs text-gray-400">{formatDate(article.updated_at)}</time>
                    {fromSubsection && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">
                        {fromSubsection.title}
                      </span>
                    )}
                    {article.is_members_only && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Pouze pro členy
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 transition-colors leading-snug mb-2">
                    {article.title}
                  </h2>
                  {preview && (
                    <div
                      className="text-sm text-gray-500 line-clamp-3 excerpt-preview"
                      dangerouslySetInnerHTML={{ __html: preview }}
                    />
                  )}
                  <span className="mt-3 text-sm text-green-600 font-medium">
                    Číst více →
                  </span>
                </div>
              </Link>
            </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
