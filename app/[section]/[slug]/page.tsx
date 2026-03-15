import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArticleGallery } from '@/components/gallery/ArticleGallery'

type Props = {
  params: Promise<{ section: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: sectionSlug, slug } = await params
  const supabase = await createClient()

  const { data: section } = await supabase
    .from('sections')
    .select('id')
    .eq('slug', sectionSlug)
    .single()

  if (!section) return {}

  const { data } = await supabase
    .from('pages')
    .select('title, excerpt, meta')
    .eq('section_id', section.id)
    .eq('slug', slug)
    .single()

  if (!data) return {}

  const meta = data.meta as Record<string, string> | null
  return {
    title: meta?.seo_title ?? data.title,
    description: meta?.seo_description ?? data.excerpt ?? undefined,
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ArticlePage({ params }: Props) {
  const { section: sectionSlug, slug } = await params
  const supabase = await createClient()

  const [{ data: section }, { data: { user } }] = await Promise.all([
    supabase
      .from('sections')
      .select('id, slug, title')
      .eq('slug', sectionSlug)
      .eq('is_active', true)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!section) notFound()

  const { data: page } = await supabase
    .from('pages')
    .select('id, slug, title, excerpt, content, image_url, is_members_only, published_at')
    .eq('section_id', section.id)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!page) notFound()

  // Ochrana: only-members obsah → přesměrovat na přihlášení
  if (page.is_members_only && !user) {
    redirect(`/login?redirectTo=/${sectionSlug}/${slug}`)
  }

  const { data: galleryImages } = await supabase
    .from('page_gallery')
    .select('public_url, alt_text')
    .eq('page_id', page.id)
    .order('sort_order')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 flex flex-wrap items-center gap-2">
        <Link href="/" className="hover:text-green-600 transition-colors">Domů</Link>
        <span>/</span>
        <Link href={`/${sectionSlug}`} className="hover:text-green-600 transition-colors">
          {section.title}
        </Link>
        <span>/</span>
        <span className="text-gray-700 truncate max-w-xs">{page.title}</span>
      </nav>

      <article>
        {page.is_members_only && (
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full mb-4">
            Pouze pro členy
          </span>
        )}

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-3">
          {page.title}
        </h1>

        <time className="block text-sm text-gray-400 mb-8">
          {formatDate(page.published_at)}
        </time>

        {page.image_url && (
          <img
            src={page.image_url}
            alt={page.title}
            className="w-full h-64 sm:h-80 object-cover rounded-2xl mb-8"
          />
        )}

        {page.excerpt && (
          <p className="text-lg text-gray-600 leading-relaxed border-l-4 border-green-300 pl-4 mb-8">
            {page.excerpt}
          </p>
        )}

        {page.content && (
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        )}

        <ArticleGallery
          images={(galleryImages ?? []).map(g => ({ url: g.public_url, alt: g.alt_text }))}
        />
      </article>

      <div className="mt-12 pt-6 border-t border-gray-100">
        <Link
          href={`/${sectionSlug}`}
          className="inline-flex items-center gap-2 text-sm text-green-600 font-medium hover:text-green-800 transition-colors"
        >
          ← Zpět na {section.title}
        </Link>
      </div>
    </div>
  )
}
