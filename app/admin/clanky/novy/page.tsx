import { createClient } from '@/lib/supabase/server'
import { ArticleForm } from '../ArticleForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin – Nový článek' }

export default async function NovyClankPage() {
  const supabase = await createClient()
  const { data: sections } = await supabase
    .from('sections')
    .select('id, slug, title')
    .eq('is_active', true)
    .order('menu_order')

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Nový článek</h2>
      <ArticleForm sections={sections ?? []} />
    </div>
  )
}
