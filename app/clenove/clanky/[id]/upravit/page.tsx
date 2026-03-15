import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ContributorArticleForm } from '../../../ContributorArticleForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Upravit článek' }

type Props = { params: Promise<{ id: string }> }
type SearchParams = Promise<{ success?: string; error?: string }>

export default async function ContributorEditPage({
  params,
  searchParams,
}: Props & { searchParams: SearchParams }) {
  const { id } = await params
  const { success, error } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ověř přístup: spoluautor NEBO manager/admin
  const [{ data: contributor }, { data: profile }] = await Promise.all([
    supabase
      .from('article_contributors')
      .select('id')
      .eq('page_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  const isManagerOrAbove = profile && ['admin', 'manager'].includes(profile.role)
  if (!contributor && !isManagerOrAbove) redirect('/clenove?error=forbidden')

  // Načti článek + galerii
  const [{ data: article }, { data: galleryImages }] = await Promise.all([
    supabase
      .from('pages')
      .select('id, title, content')
      .eq('id', id)
      .single(),
    supabase
      .from('page_gallery')
      .select('id, public_url, alt_text, sort_order')
      .eq('page_id', id)
      .order('sort_order'),
  ])

  if (!article) notFound()

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit příspěvek</h1>
          <p className="text-sm text-gray-400 mt-0.5">Můžete upravit obsah a fotogalerii.</p>
        </div>
        <a
          href="/clenove"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Zpět
        </a>
      </div>

      {success && (
        <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✓ Změny byly uloženy.
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Chyba: {decodeURIComponent(error)}
        </div>
      )}

      <ContributorArticleForm
        pageId={article.id}
        title={article.title}
        content={article.content}
        galleryImages={galleryImages ?? []}
      />
    </div>
  )
}
