import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArticleGallery } from '@/components/gallery/ArticleGallery'
import { CommentForm } from './CommentForm'
import { Pencil, FileDown, MessageSquare } from 'lucide-react'

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
    .select('id, slug, title, excerpt, content, image_url, visibility, allow_comments, published_at')
    .eq('section_id', section.id)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!page) notFound()

  // Přístupová kontrola podle visibility
  // Nejprve zjistíme roli uživatele (potřebujeme ji pro editor/admin check)
  let userRole: string | null = null
  if (user) {
    const { data: up } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    if (up?.is_active) userRole = up.role ?? 'member'
  }

  const visibilityLevel: Record<string, number> = { public: 0, member: 1, editor: 2, admin: 3 }
  const roleLevel: Record<string, number> = { member: 1, contributor: 1, editor: 2, manager: 3, admin: 3 }
  const requiredLevel = visibilityLevel[page.visibility] ?? 0
  const userLevel = userRole ? (roleLevel[userRole] ?? 1) : 0

  if (requiredLevel > userLevel) {
    redirect(`/login?redirectTo=/${sectionSlug}/${slug}`)
  }

  // Parallelní dotazy: galerie, dokumenty, komentáře
  const [
    { data: galleryImages },
    { data: documents },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from('page_gallery')
      .select('public_url, alt_text')
      .eq('page_id', page.id)
      .order('sort_order'),
    supabase
      .from('page_documents')
      .select('id, title, description, file_url, document_date')
      .eq('page_id', page.id)
      .order('sort_order'),
    page.allow_comments
      ? supabase
          .from('page_comments')
          .select('id, content, created_at, user_profiles(full_name, email)')
          .eq('page_id', page.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: null }),
  ])

  // Je uživatel contributor tohoto článku?
  const isPrivileged = userRole === 'admin' || userRole === 'manager'
  let isContributor = false
  if (user && !isPrivileged) {
    const { data: contrib } = await supabase
      .from('article_contributors')
      .select('id')
      .eq('page_id', page.id)
      .eq('user_id', user.id)
      .maybeSingle()
    isContributor = !!contrib
  }

  const editHref = isPrivileged
    ? `/admin/clanky/${page.id}/upravit`
    : isContributor
    ? `/clenove/clanky/${page.id}/upravit`
    : null

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
        {/* Badges + edit pencil */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {page.visibility !== 'public' && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                {page.visibility === 'member' && 'Pouze pro členy'}
                {page.visibility === 'editor' && 'Editor a výše'}
                {page.visibility === 'admin' && 'Pouze administrátor'}
              </span>
            )}
          </div>
          {editHref && (
            <Link
              href={editHref}
              title="Upravit článek"
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors"
            >
              <Pencil size={12} />
              Upravit
            </Link>
          )}
        </div>

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

        {/* Přílohy (dokumenty) */}
        {documents && documents.length > 0 && (
          <div className="mt-10 pt-6 border-t border-gray-100">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
              <FileDown size={16} className="text-gray-400" />
              Přílohy
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{doc.title}</div>
                    {doc.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{doc.description}</div>
                    )}
                    {doc.document_date && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(doc.document_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <FileDown size={13} />
                    Stáhnout
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Komentáře */}
        {page.allow_comments && (
          <div className="mt-10 pt-6 border-t border-gray-100">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-4">
              <MessageSquare size={16} className="text-gray-400" />
              Komentáře
              {comments && comments.length > 0 && (
                <span className="ml-1 text-xs font-normal text-gray-400">({comments.length})</span>
              )}
            </h2>

            {(!comments || comments.length === 0) && (
              <p className="text-sm text-gray-400 mb-6">Zatím žádné komentáře. Buďte první!</p>
            )}

            {comments && comments.length > 0 && (
              <div className="space-y-4 mb-6">
                {comments.map(c => {
                  type AuthorRow = { full_name: string | null; email: string } | null
                  const profileRaw = c.user_profiles
                  const author: AuthorRow = Array.isArray(profileRaw)
                    ? (profileRaw[0] as AuthorRow) ?? null
                    : (profileRaw as AuthorRow)
                  const name = author?.full_name ?? author?.email ?? 'Anonym'
                  return (
                    <div key={c.id} className="flex gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 select-none uppercase">
                        {name.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{name}</span>
                          <time className="text-xs text-gray-400">
                            {new Date(c.created_at).toLocaleDateString('cs-CZ', {
                              day: 'numeric', month: 'long', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.content}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {user ? (
              <CommentForm
                pageId={page.id}
                sectionSlug={sectionSlug}
                articleSlug={slug}
              />
            ) : (
              <p className="text-sm text-gray-500">
                <Link href={`/login?redirectTo=/${sectionSlug}/${slug}`} className="text-green-600 font-medium hover:underline">
                  Přihlaste se
                </Link>{' '}
                pro přidání komentáře.
              </p>
            )}
          </div>
        )}
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
