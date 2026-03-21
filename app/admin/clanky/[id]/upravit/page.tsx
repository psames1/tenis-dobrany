import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ArticleForm } from '../../ArticleForm'
import Link from 'next/link'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Admin – Upravit článek' }

export default async function EditArticlePage({ params, searchParams }: Props & {
  searchParams: Promise<{ success?: string; error?: string; notified?: string }>
}) {
  const { id } = await params
  const { success, error, notified } = await (searchParams as unknown as Promise<{ success?: string; error?: string; notified?: string }>)
  const supabase = await createClient()

  const [{ data: article }, { data: sections }, { data: galleryImages }, { data: contributors }, { data: savedDocuments }] = await Promise.all([
    supabase
      .from('pages')
      .select('id, title, slug, section_id, excerpt, content, image_url, is_active, is_members_only, is_news, show_in_menu, allow_comments, visibility, sort_order, published_at')
      .eq('id', id)
      .single(),
    supabase
      .from('sections')
      .select('id, slug, title')
      .eq('is_active', true)
      .order('menu_order'),
    supabase
      .from('page_gallery')
      .select('id, public_url, alt_text, sort_order')
      .eq('page_id', id)
      .order('sort_order'),
    supabase
      .from('article_contributors')
      .select('id, email, user_id, user_profiles(full_name)')
      .eq('page_id', id)
      .order('invited_at'),
    supabase
      .from('page_documents')
      .select('title, description, file_url, document_date')
      .eq('page_id', id)
      .order('sort_order'),
  ])

  if (!article) notFound()

  // Vygeneruj signed URL pro FileDown tlačítka v administraci
  function extractDocPath(url: string): string | null {
    try {
      const u = new URL(url)
      const prefix = '/storage/v1/object/public/documents/'
      if (u.pathname.startsWith(prefix)) return decodeURIComponent(u.pathname.slice(prefix.length))
    } catch { /* není Supabase storage URL */ }
    return null
  }

  const adminStorage = createAdminClient().storage
  const docsWithSignedUrls = await Promise.all(
    (savedDocuments ?? []).map(async (doc) => {
      const path = extractDocPath(doc.file_url)
      if (!path) return { ...doc, display_url: doc.file_url }
      const { data } = await adminStorage.from('documents').createSignedUrl(path, 3600)
      return { ...doc, display_url: data?.signedUrl ?? doc.file_url }
    })
  )

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Upravit článek</h2>
        <Link
          href="/admin/clanky"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Zpět na seznam
        </Link>
      </div>

      {success && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Článek byl uložen.
          {notified && (
            <span className="ml-2 text-green-600">
              E-mailová notifikace odeslána {notified} členům.
            </span>
          )}
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      <ArticleForm article={article} sections={sections ?? []} galleryImages={galleryImages ?? []} contributors={(contributors ?? []) as unknown as import('@/app/admin/clanky/ArticleContributors').ContributorRecord[]} savedDocuments={docsWithSignedUrls as { title: string; description: string; file_url: string; document_date: string; display_url?: string }[]} />
    </div>
  )
}
